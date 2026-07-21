import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import * as cheerio from "cheerio";
import { ts } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({ id: properties.id, url: properties.url })
      .from(properties)
      .where(
        and(
          eq(properties.portalName, "idnes-reality"),
          isNull(properties.description),
        )
      );

    if (rows.length === 0) {
      return NextResponse.json({ message: "No idnes-reality properties missing description", fixed: 0 });
    }

    let fixed = 0;
    let errors: string[] = [];

    for (const row of rows) {
      try {
        const res = await fetch(row.url, {
          headers: {
            "User-Agent": UA,
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "cs,en;q=0.9",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          errors.push(`HTTP ${res.status}: ${row.url}`);
          continue;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        const descEl = $("div.b-desc");
        const description = descEl.length ? descEl.text().trim() : null;

        if (description) {
          await db
            .update(properties)
            .set({ description })
            .where(eq(properties.id, row.id));
          fixed++;
        }
      } catch (err) {
        errors.push(`${row.url}: ${err}`);
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixed} of ${rows.length} properties`,
      fixed,
      total: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
