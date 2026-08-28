import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { deskaDocuments, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchDocumentText, type EdeskyDocument } from "@/lib/deska/edesky-client";
import { classifyDocument } from "@/lib/deska/classify";
import { generateId, ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { document?: EdeskyDocument };

    const doc = body.document;
    if (!doc?.edesky_id || !doc?.name) {
      return NextResponse.json({ error: "document with edesky_id and name is required" }, { status: 400 });
    }

    const existing = await db
      .select({ id: deskaDocuments.id })
      .from(deskaDocuments)
      .where(eq(deskaDocuments.edeskyId, doc.edesky_id))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return NextResponse.json({ id: existing.id, alreadyExists: true });
    }

    const textContent = await fetchDocumentText(doc.edesky_text_url);
    const { category, relevance, keywordsMatched } = classifyDocument(doc.name, textContent);

    const insertedId = generateId();
    const now = ts();

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
      textContent,
      createdAtDeska: doc.created_at,
      scrapedAt: now,
      relevance,
      rawData: JSON.stringify(doc),
    });

    if (relevance === "HIGH") {
      await db.insert(notifications).values({
        id: generateId(),
        userId: session.user.id,
        title: `Nový dokument na úřední desce`,
        message: `${doc.name} — ${doc.dashboard_name}`,
        type: "deska_new",
        read: false,
        data: JSON.stringify({ deskaDocumentId: insertedId }),
        createdAt: now,
      });
    }

    return NextResponse.json({ id: insertedId, alreadyExists: false, category, relevance });
  } catch (error) {
    console.error("Deska save-from-search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
