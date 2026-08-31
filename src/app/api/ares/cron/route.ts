import { NextResponse } from "next/server";
import { db } from "@/db";
import { aresCompanies, aresPolls, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";
import {
  listNotificationBatches,
  getNotificationBatch,
  getCompanyDetail,
} from "@/lib/ares/ares-client";
import { lookupOwnershipByIco, hasApartment } from "@/lib/ares/catastr-client";
import { scoreAresCompany } from "@/lib/ares/scorer";
import type { CatastrOwnership } from "@/lib/ares/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Tuned for the Vercel Hobby 60s cap and the ARES ~500 req/min limit.
const MAX_ICOS_PER_RUN = Number(process.env.ARES_MAX_ICOS_PER_RUN ?? 40);
const SCAN_DELAY_MS = Number(process.env.ARES_SCAN_DELAY_MS ?? 800);

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pollId = generateId();
  const now = ts();

  await db.insert(aresPolls).values({
    id: pollId,
    startedAt: now,
    status: "running",
    lastIcoIndex: 0,
    companiesScanned: 0,
    liquidationsFound: 0,
    apartmentsFound: 0,
  });

  try {
    const lastPoll = await db
      .select({ lastBatchId: aresPolls.lastBatchId, lastIcoIndex: aresPolls.lastIcoIndex })
      .from(aresPolls)
      .where(eq(aresPolls.status, "completed"))
      .orderBy(desc(aresPolls.finishedAt))
      .limit(1)
      .then((r) => r[0]);

    const batches = await listNotificationBatches();
    const latest = batches[0];
    if (!latest) {
      await markPoll(pollId, {
        finishedAt: ts(),
        lastBatchId: lastPoll?.lastBatchId ?? 0,
        lastIcoIndex: 0,
        companiesScanned: 0,
        liquidationsFound: 0,
        apartmentsFound: 0,
        status: "completed",
      });
      return NextResponse.json({ pollId, scanned: 0, liquidations: 0, apartments: 0 });
    }

    const targetBatchId = latest.cisloDavky;
    const notifs = await getNotificationBatch(targetBatchId);
    const notifsLen = notifs.length;

    // Latest batch already fully scanned and no newer batch appeared.
    if (
      lastPoll?.lastBatchId === targetBatchId &&
      (lastPoll?.lastIcoIndex ?? 0) >= notifsLen
    ) {
      await markPoll(pollId, {
        finishedAt: ts(),
        lastBatchId: targetBatchId,
        lastIcoIndex: notifsLen,
        companiesScanned: 0,
        liquidationsFound: 0,
        apartmentsFound: 0,
        status: "completed",
      });
      return NextResponse.json({
        pollId,
        scanned: 0,
        liquidations: 0,
        apartments: 0,
        lastBatchId: targetBatchId,
      });
    }

    const startIndex =
      lastPoll?.lastBatchId === targetBatchId ? (lastPoll.lastIcoIndex ?? 0) : 0;

    let scanned = 0;
    let liquidations = 0;
    let apartments = 0;
    let lastIndex = startIndex;

    for (let i = startIndex; i < notifsLen && scanned < MAX_ICOS_PER_RUN; i++) {
      lastIndex = i;
      const n = notifs[i];
      const ico = n.icoId;
      if (n.typZmeny === "DEL" || !/^\d{8}$/.test(ico)) continue;

      const existing = await db
        .select({ id: aresCompanies.id })
        .from(aresCompanies)
        .where(eq(aresCompanies.ico, ico))
        .limit(1)
        .then((r) => r[0]);

      if (!existing) {
        try {
          const detail = await getCompanyDetail(ico);
          scanned++;

          if (detail.isLiquidating || detail.hasExecution) {
            const ownership: CatastrOwnership | null =
              await lookupOwnershipByIco(ico);
            const { score, reasons } = scoreAresCompany(detail, ownership, now);
            const apartmentFound = ownership ? hasApartment(ownership) : false;
            liquidations++;
            if (apartmentFound) apartments++;

            const insertedId = generateId();
            await db.insert(aresCompanies).values({
              id: insertedId,
              ico,
              name: detail.name,
              legalForm: detail.legalForm,
              sidlo: detail.sidlo,
              court: detail.court,
              spisovaZnacka: detail.spisovaZnacka,
              status: detail.hasExecution ? "EXEKUCE" : "LIKVIDACE",
              liquidationDate: detail.liquidationDate,
              lastUpdatedAres: detail.lastUpdatedAres,
              reasoning: detail.liquidationReasoning,
              isLiquidating: detail.isLiquidating ? 1 : 0,
              hasExecution: detail.hasExecution ? 1 : 0,
              propertyOwned: JSON.stringify(ownership),
              propertyVerified: ownership?.verified ? 1 : 0,
              apartmentFound: apartmentFound ? 1 : 0,
              score,
              pipeline: "new",
              createdAt: now,
              updatedAt: now,
            });

            if (score >= 70 || apartmentFound) {
              const users = await db.query.users?.findMany?.();
              if (users && users.length > 0) {
                await db.insert(notifications).values({
                  id: generateId(),
                  userId: users[0].id,
                  title: "Likvidace — kandidát k flippu",
                  message: `${detail.name ?? ico} — ${apartmentFound ? "byt v majetku" : "majetek neověřen"} — Skóre: ${score}`,
                  type: "ares_new",
                  read: false,
                  data: JSON.stringify({ aresCompanyId: insertedId, reasons }),
                  createdAt: now,
                });
              }
            }
          }
        } catch (err) {
          console.warn(`[ARES] Failed ICO ${ico}:`, err);
        }
        await new Promise((r) => setTimeout(r, SCAN_DELAY_MS));
      }
    }

    // Cursor now points one past the last processed entry. If we consumed the
    // whole batch, the next run moves to a newer batch automatically.
    const indexAfter = lastIndex + 1;
    const batchDone = indexAfter >= notifsLen;

    await markPoll(pollId, {
      finishedAt: ts(),
      lastBatchId: targetBatchId,
      lastIcoIndex: batchDone ? notifsLen : indexAfter,
      companiesScanned: scanned,
      liquidationsFound: liquidations,
      apartmentsFound: apartments,
      status: "completed",
    });

    return NextResponse.json({
      pollId,
      scanned,
      liquidations,
      apartments,
      lastBatchId: targetBatchId,
      lastIcoIndex: indexAfter,
      batchDone,
    });
  } catch (error) {
    console.error("[ARES] Cron error:", error);
    await markPoll(pollId, {
      finishedAt: ts(),
      status: "failed",
      error: String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function markPoll(
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  await db.update(aresPolls).set(patch as never).where(eq(aresPolls.id, id));
}
