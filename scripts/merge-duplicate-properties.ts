import "./_env";
import { db } from "../src/db";
import { properties, activityLog } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts, safeJsonParse } from "../src/lib/utils";
import { PROPERTY_STATUS } from "../src/lib/scraping/relisting";
import {
  matchStrengthCrossPortal,
  isAutoMergeMatch,
  sharedAddressTokens,
  parseAltPortals,
  appendAltPortal,
  toDbAltPortals,
  type MatchCandidate,
  type MatchStrength,
} from "../src/lib/scraping/property-match";

/**
 * Jednorazovy backfill: najde stejne nemovitosti duplicitne ulozene napric
 * portaly (existovaly pred zavedenim cross-portal slucovani) a slouci je do
 * kanonickeho zaznamu pres alt_portals.
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-properties.ts               # jen report
 *   npx tsx scripts/merge-duplicate-properties.ts --apply --yes # slouci strong+medium
 *   npx tsx scripts/merge-duplicate-properties.ts --window 90   # okno dni (def. 365)
 */

const WINDOW_DAYS_DEFAULT = 365;

interface Row {
  id: string;
  url: string;
  portalName: string;
  title: string;
  address: string | null;
  rooms: string | null;
  area: number | null;
  price: number;
  isActive: number | null;
  lastSeen: number | null;
  status: string | null;
  removedAt: number | null;
  altPortals: unknown;
  description: string | null;
  imageUrls: string | null;
}

function toCandidate(r: Row): MatchCandidate {
  return {
    id: r.id,
    portalName: r.portalName,
    title: r.title,
    address: r.address,
    rooms: r.rooms,
    area: r.area,
    price: r.price,
    lastSeen: r.lastSeen,
    isActive: r.isActive,
  };
}

function completeness(r: Row): number {
  const imgs = r.imageUrls ? safeJsonParse<string[]>(r.imageUrls, []) : [];
  return (r.address ? 2 : 0) + (r.description ? 1 : 0) + Math.min(imgs.length, 5) + (r.area ? 1 : 0);
}

function canonicalOf(group: Row[]): Row {
  return [...group].sort((a, b) => {
    const aScore = (a.isActive === 1 ? 1 : 0) * 1e12 + (a.lastSeen ?? 0) + completeness(a);
    const bScore = (b.isActive === 1 ? 1 : 0) * 1e12 + (b.lastSeen ?? 0) + completeness(b);
    return bScore - aScore;
  })[0];
}

class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmed = process.argv.includes("--yes");
  if (apply && !confirmed) {
    console.log("--apply vyzaduje i --yes (pojistka proti nechtenemu zapisu).");
    process.exit(0);
  }
  const windowIdx = process.argv.indexOf("--window");
  const windowDays =
    windowIdx > -1 ? Number(process.argv[windowIdx + 1]) || WINDOW_DAYS_DEFAULT : WINDOW_DAYS_DEFAULT;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  if (apply) console.log("=== APPLY MODE — slucuji se strong+medium shody ===");
  else console.log("=== DRY RUN — jen report (pridej --apply --yes pro zapis) ===");

  const rows = (await db
    .select({
      id: properties.id,
      url: properties.url,
      portalName: properties.portalName,
      title: properties.title,
      address: properties.address,
      rooms: properties.rooms,
      area: properties.area,
      price: properties.price,
      isActive: properties.isActive,
      lastSeen: properties.lastSeen,
      status: properties.status,
      removedAt: properties.removedAt,
      altPortals: properties.altPortals,
      description: properties.description,
      imageUrls: properties.imageUrls,
    })
    .from(properties)) as unknown as Row[];

  const active = rows.filter((r) => r.lastSeen && r.lastSeen >= cutoff);
  console.log(`Zaznamu v okne (${windowDays} dni): ${active.length} / ${rows.length}`);

  const uf = new UnionFind();
  const edges: { a: Row; b: Row; strength: MatchStrength }[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.url === b.url) continue;
      const s = matchStrengthCrossPortal(
        { portalName: a.portalName, title: a.title, address: a.address, rooms: a.rooms, area: a.area, price: a.price },
        toCandidate(b)
      );
      if (s === "none") continue;
      edges.push({ a, b, strength: s });
      if (isAutoMergeMatch(s)) uf.union(a.id, b.id);
    }
  }

  const groups = new Map<string, Row[]>();
  for (const r of active) {
    const root = uf.find(r.id);
    const g = groups.get(root) ?? [];
    g.push(r);
    groups.set(root, g);
  }

  const clusters = [...groups.values()].filter((g) => g.length > 1);
  const weakEdges = edges.filter((e) => e.strength === "weak");
  const strongN = edges.filter((e) => e.strength === "strong").length;
  const mediumN = edges.filter((e) => e.strength === "medium").length;
  console.log(
    `Nalezeno ${clusters.length} skupin duplicit (${strongN}x strong / ${mediumN}x medium / ${weakEdges.length}x weak jen-info)`
  );

  let planned = 0;
  for (const group of clusters) {
    const canon = canonicalOf(group);
    const others = group.filter((r) => r.id !== canon.id);
    let strength: MatchStrength = "medium";
    for (const o of others) {
      const s = matchStrengthCrossPortal(
        { portalName: canon.portalName, title: canon.title, address: canon.address, rooms: canon.rooms, area: canon.area, price: canon.price },
        toCandidate(o)
      );
      if (s === "strong") {
        strength = "strong";
        break;
      }
    }
    planned += others.length;
    console.log(
      `--- [${strength}] kanon: ${canon.portalName} #${canon.id.slice(0, 8)} | ${canon.title} | ${canon.address ?? "?"} (${canon.area ?? "?"} m2, ${canon.price} Kc${canon.isActive === 1 ? ", AKTIVNI" : ""})`
    );
    for (const o of others) {
      const imgs = o.imageUrls ? safeJsonParse<string[]>(o.imageUrls, []).length : 0;
      console.log(
        `      duplicita: ${o.portalName} #${o.id.slice(0, 8)} | ${o.title} | ${o.address ?? "?"} (${o.area ?? "?"} m2, ${o.price} Kc${o.isActive === 1 ? ", AKTIVNI" : ""}, ${imgs} obr.)`
      );
    }

    if (!apply) continue;
    for (const o of others) {
      const alts = appendAltPortal(parseAltPortals(canon.altPortals), o.portalName, o.url);
      await db.update(properties).set({ altPortals: toDbAltPortals(alts) }).where(eq(properties.id, canon.id));
      await db
        .update(properties)
        .set({
          isActive: 0,
          status: PROPERTY_STATUS.REMOVED,
          removedAt: ts(),
          lastSeen: o.lastSeen ?? ts(),
        })
        .where(eq(properties.id, o.id));
      await db.insert(activityLog).values({
        id: generateId(),
        type: "scraping",
        message: `Slouceno do kanonickeho zaznamu (backfill) - ${o.title}`,
        propertyId: canon.id,
        createdAt: ts(),
      });
    }
  }

  if (weakEdges.length > 0) {
    console.log("-- Slabe shody (weak, BEZ automatickeho slouceni - rucni kontrola) --");
    for (const e of weakEdges.slice(0, 40)) {
      console.log(
        `  ${e.a.portalName} #${e.a.id.slice(0, 8)} ${e.a.address ?? "?"} (${e.a.area ?? "?"} m2)  ~  ${e.b.portalName} #${e.b.id.slice(0, 8)} ${e.b.address ?? "?"} (${e.b.area ?? "?"} m2)  [${sharedAddressTokens(e.a.address, e.b.address).join(", ")}]`
      );
    }
    if (weakEdges.length > 40) console.log(`  ... a dalsich ${weakEdges.length - 40} slabych shod`);
  }

  if (apply && planned > 0) console.log(`Sloucenych duplicit: ${planned}`);
  if (apply && planned === 0) console.log("Nic ke slouceni.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
