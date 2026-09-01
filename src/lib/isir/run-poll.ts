import { db } from "@/db";
import { insolvencyEvents, isirPolls, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { getLastPodnetId, getEventData, isSectionRelevant, extractCourtFromSpis, extractDruhStavRizeni } from "@/lib/isir/isir-client";
import { extractApartmentFromPdf, parsePdfFromUrl } from "@/lib/isir/apartment-parser";
import { scoreInsolvencyLead } from "@/lib/isir/scorer";
import type { IsirEventData } from "@/lib/isir/types";

export interface IsirPollResult {
  pollId: string;
  eventsScanned: number;
  apartmentsFound: number;
  lastPodnetId: number;
}

// Tuned for the Vercel Hobby 60s execution cap while still catching up fast.
const MAX_IDS_PER_RUN = Number(process.env.ISIR_MAX_IDS_PER_RUN ?? 40);
const SCAN_DELAY_MS = Number(process.env.ISIR_SCAN_DELAY_MS ?? 1200);
// On a cold start (no previous completed poll) we begin a short window
// behind the current maximum instead of the old 80,000,000 baseline, so the
// very first scan already produces recent, high-value records.
const COLD_START_WINDOW = Number(process.env.ISIR_COLD_START_WINDOW ?? 400);

export async function runIsirPoll(): Promise<IsirPollResult> {
  const pollId = generateId();
  const now = ts();

  await db.insert(isirPolls).values({
    id: pollId,
    startedAt: now,
    status: "running",
    eventsFound: 0,
    apartmentsFound: 0,
  });

  try {
    const lastPoll = await db
      .select({ lastPodnetId: isirPolls.lastPodnetId })
      .from(isirPolls)
      .where(eq(isirPolls.status, "completed"))
      .orderBy(desc(isirPolls.finishedAt))
      .limit(1)
      .then((r) => r[0]);

    const currentMax = await getLastPodnetId();

    // On a cold start (no completed poll yet) begin a recent window behind the
    // current maximum so the first scan produces data immediately.
    const fromId = lastPoll?.lastPodnetId ?? Math.max(0, currentMax - COLD_START_WINDOW);

    if (currentMax <= fromId) {
      await db
        .update(isirPolls)
        .set({
          finishedAt: ts(),
          lastPodnetId: currentMax,
          eventsFound: 0,
          apartmentsFound: 0,
          status: "completed",
        })
        .where(eq(isirPolls.id, pollId));

      return {
        pollId,
        eventsScanned: 0,
        apartmentsFound: 0,
        lastPodnetId: currentMax,
      };
    }

    const events: IsirEventData[] = [];
    const upper = Math.min(currentMax, fromId + MAX_IDS_PER_RUN);

    // Cursor smí poskočit jen na NEJDELŠÍ SOUVISLÝ úspěšný prefix — při
    // mezilehlém selhání getEventData by posun na `upper` ztratil dané ID
    // navždy (feed je sekvenční, dedup podle spisové značky snáší re-processing).
    let firstFailedId: number | null = null;
    for (let id = fromId + 1; id <= upper; id++) {
      try {
        const data = await getEventData(id);
        events.push(...data);
      } catch (err) {
        console.warn(`[ISIR] Failed to fetch ID ${id}:`, err);
        if (firstFailedId === null) firstFailedId = id;
      }
      if (id < upper) {
        await new Promise((r) => setTimeout(r, SCAN_DELAY_MS));
      }
    }

    const lastId = firstFailedId === null ? upper : firstFailedId - 1;

    let apartmentsFound = 0;
    const groupedBySpis = new Map<string, IsirEventData[]>();

    for (const event of events) {
      if (!isSectionRelevant(event.oddil)) continue;

      const existing = groupedBySpis.get(event.spisovaZnacka);
      if (existing) {
        existing.push(event);
      } else {
        groupedBySpis.set(event.spisovaZnacka, [event]);
      }
    }

    for (const [spisovaZnacka, events] of groupedBySpis) {
      const existing = await db
        .select({ id: insolvencyEvents.id })
        .from(insolvencyEvents)
        .where(eq(insolvencyEvents.spisovaZnacka, spisovaZnacka))
        .limit(1)
        .then((r) => r[0]);

      if (existing) continue;

      const bestEvent = events.reduce((best, e) => {
        if (e.oddil?.toUpperCase() === "D") return e;
        if (e.oddil?.toUpperCase() === "B" && best.oddil?.toUpperCase() !== "D") return e;
        return best;
      });

      let apartmentData: import("@/lib/isir/types").ApartmentData | null = null;
      let docText = "";
      if (bestEvent.dokumentUrl) {
        const { text } = await parsePdfFromUrl(bestEvent.dokumentUrl);
        docText = text;
        if (text) {
          apartmentData = extractApartmentFromPdf(text);
        }
      }

      if (!apartmentData) {
        apartmentData = { address: null, disposition: null, area: null, cadastralArea: null, lvNumber: null, estimatedPrice: null, rawText: docText.slice(0, 4000) };
      } else if (!apartmentData.rawText) {
        apartmentData.rawText = docText.slice(0, 4000);
      }

      const publishedAtRaw = new Date(bestEvent.datumZverejneniUdalosti || bestEvent.datumZalozeniUdalosti).getTime();
      // obě data prázdná/neplatná → Date("undefined") = NaN (lepí se do DB)
      const publishedAt = Number.isFinite(publishedAtRaw) ? publishedAtRaw : now;
      const { score } = scoreInsolvencyLead(bestEvent, apartmentData, publishedAt);
      const court = extractCourtFromSpis(spisovaZnacka);
      const druhaStavu = extractDruhStavRizeni(bestEvent.poznamka);

      const insertedId = generateId();
      await db.insert(insolvencyEvents).values({
        id: insertedId,
        podnetId: bestEvent.id,
        spisovaZnacka,
        court,
        eventType: bestEvent.typUdalosti,
        eventDesc: bestEvent.popisUdalosti,
        section: bestEvent.oddil,
        sectionOrder: bestEvent.cisloVOddilu,
        documentUrl: bestEvent.dokumentUrl,
        notes: druhaStavu,
        publishedAt,
        apartmentFound: apartmentData.address || apartmentData.disposition ? 1 : 0,
        apartmentData: JSON.stringify(apartmentData),
        score,
        status: "new",
        createdAt: now,
        updatedAt: now,
      });

      // počítáme nálezy BYTŮ (address/dispozice), ne nový insolvenční případ
      if (apartmentData.address || apartmentData.disposition) apartmentsFound++;

      if (score >= 70) {
        const users = await db.query.users?.findMany?.();
        if (users && users.length > 0) {
          await db.insert(notifications).values({
            id: generateId(),
            userId: users[0].id,
            title: "Nová insolvence s bytem",
            message: `${apartmentData.disposition ?? "Byt"} — ${spisovaZnacka} — Skóre: ${score}`,
            type: "isir_new",
            read: false,
            data: JSON.stringify({ insolvencyEventId: insertedId }),
            createdAt: now,
          });
        }
      }
    }

    await db
      .update(isirPolls)
      .set({
        finishedAt: ts(),
        lastPodnetId: lastId,
        eventsFound: events.length,
        apartmentsFound,
        status: "completed",
      })
      .where(eq(isirPolls.id, pollId));

    return {
      pollId,
      eventsScanned: events.length,
      apartmentsFound,
      lastPodnetId: lastId,
    };
  } catch (error) {
    await db
      .update(isirPolls)
      .set({
        finishedAt: ts(),
        status: "failed",
        error: String(error),
      })
      .where(eq(isirPolls.id, pollId));

    throw error;
  }
}