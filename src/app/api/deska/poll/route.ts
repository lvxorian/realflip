import { NextResponse } from "next/server";
import { db } from "@/db";
import { deskaDocuments, deskaWatches, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchDocuments } from "@/lib/deska/edesky-client";
import { classifyDocument } from "@/lib/deska/classify";
import { generateId, ts } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = ts();
    const watches = await db
      .select()
      .from(deskaWatches)
      .where(eq(deskaWatches.isActive, 1));

    let totalNew = 0;
    let totalChecked = 0;

    for (const watch of watches) {
      totalChecked++;
      const keywords = safeParseJsonArray(watch.keywords);
      if (keywords.length === 0) continue;

      const dashboardIds = safeParseJsonArray(watch.dashboardIds);
      const lastChecked = watch.lastCheckedAt
        ? new Date(watch.lastCheckedAt).toISOString().split("T")[0]
        : undefined;

      for (const kw of keywords) {
        try {
          const docs = await searchDocuments({
            keywords: kw,
            dashboardId: dashboardIds.length === 1 ? dashboardIds[0] : undefined,
            createdFrom: lastChecked,
            order: "date",
            page: 1,
          });

          for (const doc of docs.documents) {
            // Dedup by edesky_id
            const existing = await db
              .select({ id: deskaDocuments.id })
              .from(deskaDocuments)
              .where(eq(deskaDocuments.edeskyId, doc.edesky_id))
              .limit(1)
              .then((r) => r[0]);

            if (existing) continue;

            const { category, relevance, keywordsMatched } = classifyDocument(
              doc.name,
            );

            // Filter by watch category
            if (watch.category && watch.category !== category) continue;

            const insertedId = generateId();
            await db.insert(deskaDocuments).values({
              id: insertedId,
              edeskyId: doc.edesky_id,
              name: doc.name,
              dashboardName: doc.dashboard_name,
              dashboardId: doc.dashboard_id,
              category,
              keywordsMatched: keywordsMatched.join(", "),
              origUrl: doc.orig_url,
              edeskyUrl: doc.edesky_url,
              textContent: null,
              createdAtDeska: doc.created_at,
              scrapedAt: now,
              relevance,
              rawData: JSON.stringify(doc),
            });

            totalNew++;

            // Notify on HIGH relevance
            if (relevance === "HIGH") {
              await db.insert(notifications).values({
                id: generateId(),
                userId: watch.userId,
                title: `Nový dokument na úřední desce`,
                message: `${doc.name} — ${doc.dashboard_name}`,
                type: "deska_new",
                read: false,
                data: JSON.stringify({ deskaDocumentId: insertedId }),
                createdAt: now,
              });
            }
          }
        } catch (err) {
          console.error(`Deska poll error for watch ${watch.id} keyword "${kw}":`, err);
        }
      }

      // Update lastCheckedAt
      await db
        .update(deskaWatches)
        .set({ lastCheckedAt: now })
        .where(eq(deskaWatches.id, watch.id));
    }

    return NextResponse.json({ checked: totalChecked, newDocuments: totalNew });
  } catch (error) {
    console.error("Deska poll error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function safeParseJsonArray(json: unknown): string[] {
  if (Array.isArray(json)) return json;
  if (typeof json === "string") {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
