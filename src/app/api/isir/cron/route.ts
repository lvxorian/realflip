import { NextResponse } from "next/server";
import { db } from "@/db";
import { insolvencyEvents, isirPolls, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import { getLastPodnetId, getEventData, isSectionRelevant, isApartmentCandidate, extractCourtFromSpis, extractDruhStavRizeni } from "@/lib/isir/isir-client";
import { extractApartmentFromPdf, parsePdfFromUrl } from "@/lib/isir/apartment-parser";
import { scoreInsolvencyLead } from "@/lib/isir/scorer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_IDS_PER_RUN = 50;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      .orderBy(isirPolls.finishedAt)
      .limit(1)
      .then((r) => r[0]);

    const fromId = lastPoll?.lastPodnetId ?? 80000000;

    const { events: rawEvents, lastId } = await getLastPodnetId().then(async (currentMax) => {
      if (currentMax <= fromId) {
        return { events: [], lastId: currentMax };
      }

      const events = [];
      const upper = Math.min(currentMax, fromId + MAX_IDS_PER_RUN);

      for (let id = fromId + 1; id <= upper; id++) {
        try {
          const data = await getEventData(id);
          events.push(...data);
        } catch (err) {
          console.warn(`[ISIR] Failed to fetch ID ${id}:`, err);
        }
        if (id < upper) {
          await new Promise((r) => setTimeout(r, 2500));
        }
      }

      return { events, lastId: upper };
    });

    let apartmentsFound = 0;
    const groupedBySpis = new Map<string, typeof rawEvents>();

    for (const event of rawEvents) {
      if (!isSectionRelevant(event.oddil)) continue;
      if (!isApartmentCandidate(event)) continue;

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

      let apartmentData = null;
      if (bestEvent.dokumentUrl) {
        const { text } = await parsePdfFromUrl(bestEvent.dokumentUrl);
        if (text) {
          apartmentData = extractApartmentFromPdf(text);
        }
      }

      if (!apartmentData) {
        apartmentData = { address: null, disposition: null, area: null, cadastralArea: null, lvNumber: null, estimatedPrice: null, rawText: "" };
      }

      const publishedAt = new Date(bestEvent.datumZverejneniUdalosti || bestEvent.datumZalozeniUdalosti).getTime();
      const { score, reasons } = scoreInsolvencyLead(bestEvent, apartmentData, publishedAt);
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

      apartmentsFound++;

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
        eventsFound: rawEvents.length,
        apartmentsFound,
        status: "completed",
      })
      .where(eq(isirPolls.id, pollId));

    return NextResponse.json({
      pollId,
      eventsScanned: rawEvents.length,
      apartmentsFound,
      lastPodnetId: lastId,
    });
  } catch (error) {
    console.error("[ISIR] Cron error:", error);
    await db
      .update(isirPolls)
      .set({
        finishedAt: ts(),
        status: "failed",
        error: String(error),
      })
      .where(eq(isirPolls.id, pollId));

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
