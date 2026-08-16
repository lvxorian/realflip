import "./_env";
import { db } from "../src/db";
import {
  properties,
  leads,
  deals,
  propertyAnalysis,
  priceHistory,
  calculatorPresets,
  favorites,
  searchProperties,
  realizedSales,
  activityLog,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts, safeJsonParse } from "../src/lib/utils";
import { PROPERTY_STATUS, roomsEqual, normalizeText } from "../src/lib/scraping/relisting";
import { parseAltPortals, appendAltPortal, toDbAltPortals } from "../src/lib/scraping/property-match";

/**
 * Bezpecny backfill duplicit: slouci stejne nemovitosti (normalizovana adresa +
 * stejna cena + plocha + dispozice) napric portaly i v ramci portalu.
 *
 * Na rozdil od scripts/merge-duplicate-properties.ts je klada vyrazne prisnejsi
 * (zadne zostre/medium shody na zaklade tokenu — jen identicka adresa+cena+plocha),
 * a hlavne resi LIEDS: leady z duplicit se presmeruji na kanonicky zaznam a pri
 * kolizi se slouci do jednoho (pokrocilejsi stadium vyhrava).
 *
 * Usage:
 *   npx tsx scripts/dedup-cross-portal.ts               # jen report
 *   npx tsx scripts/dedup-cross-portal.ts --apply --yes # zapis
 *   npx tsx scripts/dedup-cross-portal.ts --window 90   # okno dni (def. 365)
 */

const WINDOW_DAYS_DEFAULT = 365;

interface PropertyRow {
  id: string;
  url: string;
  portalName: string;
  title: string;
  address: string | null;
  rooms: string | null;
  area: number | null;
  price: number;
  isActive: number | null;
  status: string | null;
  lastSeen: number | null;
  firstSeen: number | null;
  removedAt: number | null;
  altPortals: unknown;
  description: string | null;
  imageUrls: string | null;
  floor: number | null;
  condition: string | null;
  buildingType: string | null;
  yearBuilt: number | null;
  lat: number | null;
  lng: number | null;
  contactPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

interface LeadRow {
  id: string;
  propertyId: string;
  stage: string;
  position: number | null;
  notes: string | null;
  nextStep: string | null;
  nextStepDueAt: number | null;
  stageData: unknown;
  createdAt: number;
  updatedAt: number;
  stageEnteredAt: number | null;
  lostReason: string | null;
  portalStatus: string | null;
  portalReservedInvestorId: string | null;
  portalReservedModel: string | null;
  portalReservedStrategy: string | null;
  portalReservedAt: number | null;
  portalExpiresAt: number | null;
}

/** Poradi stadii pro vyber vitezneho leadu (closed nejvys, lost nejniz). */
const STAGE_RANK: Record<string, number> = {
  lost: 0,
  new: 1,
  contacted: 2,
  meeting: 3,
  offer: 4,
  negotiation: 5,
  closed: 6,
};

function stageRank(stage: string): number {
  return STAGE_RANK[stage] ?? 1;
}

/** Normalizace adresy: lowercase, bez diakritiky/interpunkce, bez cisel, sjednocene mezery. */
function addressKey(address: string | null | undefined): string {
  if (!address) return "";
  return normalizeText(address)
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function completeness(r: PropertyRow): number {
  const imgs = r.imageUrls ? safeJsonParse<string[]>(r.imageUrls, []) : [];
  return (r.address ? 2 : 0) + (r.description ? 1 : 0) + Math.min(imgs.length, 5) + (r.area ? 1 : 0);
}

/** Kanonicky zaznam: lead > aktivita > nejnovejsi lastSeen > nejbohatsi data. */
function canonicalOf(group: PropertyRow[], leadsByProp: Map<string, LeadRow[]>): PropertyRow {
  return [...group].sort((a, b) => {
    const score = (r: PropertyRow) =>
      (leadsByProp.get(r.id)?.length ? 1e15 : 0) +
      (r.isActive === 1 ? 1e12 : 0) +
      (r.lastSeen ?? 0) +
      completeness(r);
    return score(b) - score(a);
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

function areasWithin(a: number | null, b: number | null): boolean | null {
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) / Math.max(a, b) <= 0.1;
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

  if (apply) console.log("=== APPLY MODE — slucuji priserne shody ===");
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
      status: properties.status,
      lastSeen: properties.lastSeen,
      firstSeen: properties.firstSeen,
      removedAt: properties.removedAt,
      altPortals: properties.altPortals,
      description: properties.description,
      imageUrls: properties.imageUrls,
      floor: properties.floor,
      condition: properties.condition,
      buildingType: properties.buildingType,
      yearBuilt: properties.yearBuilt,
      lat: properties.lat,
      lng: properties.lng,
      contactPhone: properties.contactPhone,
      contactName: properties.contactName,
      contactEmail: properties.contactEmail,
    })
    .from(properties)) as unknown as PropertyRow[];

  const active = rows.filter((r) => Number(r.isActive) === 1 && r.lastSeen && r.lastSeen >= cutoff);
  console.log(`Zaznamu v okne (${windowDays} dni): ${active.length} / ${rows.length}`);

  const allLeads = (await db
    .select({
      id: leads.id,
      propertyId: leads.propertyId,
      stage: leads.stage,
      position: leads.position,
      notes: leads.notes,
      nextStep: leads.nextStep,
      nextStepDueAt: leads.nextStepDueAt,
      stageData: leads.stageData,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      stageEnteredAt: leads.stageEnteredAt,
      lostReason: leads.lostReason,
      portalStatus: leads.portalStatus,
      portalReservedInvestorId: leads.portalReservedInvestorId,
      portalReservedModel: leads.portalReservedModel,
      portalReservedStrategy: leads.portalReservedStrategy,
      portalReservedAt: leads.portalReservedAt,
      portalExpiresAt: leads.portalExpiresAt,
    })
    .from(leads)) as unknown as LeadRow[];

  const leadsByProp = new Map<string, LeadRow[]>();
  for (const l of allLeads) {
    const list = leadsByProp.get(l.propertyId) ?? [];
    list.push(l);
    leadsByProp.set(l.propertyId, list);
  }
  console.log(`Leadu celkem: ${allLeads.length}`);

  // Striktni seskupeni: normalizovana adresa + cena + plocha (+ dispozice soft).
  const buckets = new Map<string, PropertyRow[]>();
  for (const r of active) {
    const key = addressKey(r.address);
    if (!key) continue;
    if (r.price == null || r.price <= 0) continue;
    const bk = `${key}|${r.price}`;
    const list = buckets.get(bk) ?? [];
    list.push(r);
    buckets.set(bk, list);
  }

  const uf = new UnionFind();
  for (const group of buckets.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.url === b.url) continue;
        const areaOk = areasWithin(a.area, b.area);
        if (areaOk === false) continue;
        const roomsOk = roomsEqual(a.rooms, b.rooms);
        if (roomsOk === false) continue;
        uf.union(a.id, b.id);
      }
    }
  }

  const clusters = new Map<string, PropertyRow[]>();
  for (const r of active) {
    const root = uf.find(r.id);
    const g = clusters.get(root) ?? [];
    g.push(r);
    clusters.set(root, g);
  }

  const dups = [...clusters.values()].filter((g) => g.length > 1);
  console.log(`Nalezeno ${dups.length} skupin duplicit (${dups.reduce((s, g) => s + g.length - 1, 0)} zaznamu k slouceni)`);

  /** Cluster je nejisty kdyz: plochy pary lisi o > 10 %, nebo nejaky zaznam plochu nema. */
  const uncertainOf = (group: PropertyRow[]): string | null => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i].area;
        const b = group[j].area;
        if (a == null || b == null) return "cast zaznamu nema plochu";
        if (areasWithin(a, b) === false) return `plochy se lisi (${a} vs ${b} m2)`;
      }
    }
    return null;
  };

  let mergedRows = 0;
  let repointedLeads = 0;
  let mergedLeads = 0;
  let deletedLeads = 0;

  const findLeadByProp = (propId: string) => leadsByProp.get(propId) ?? [];

  for (const group of dups) {
    const canon = canonicalOf(group, leadsByProp);
    const others = group.filter((r) => r.id !== canon.id);

    const activeMembers = group.filter((r) => r.isActive === 1);
    if (activeMembers.length === 0) {
      console.log(`--- [PESKO] jen neaktivni: ${group.map((r) => r.portalName + "#" + r.id.slice(0, 8)).join(", ")}`);
      continue;
    }

    const uncertain = uncertainOf(group);
    if (uncertain) {
      console.log(`--- [NEJISTA — ${uncertain}] kanon: ${canon.portalName} #${canon.id.slice(0, 8)} | ${canon.title} | ${canon.address ?? "?"}`);
      for (const o of others) {
        console.log(`      (preskoceno) ${o.portalName} #${o.id.slice(0, 8)} | ${o.title} | ${o.area ?? "?"} m2 | ${o.url}`);
      }
      continue;
    }

    const canonLeads = findLeadByProp(canon.id);
    const allLeadsInGroup = group.flatMap((r) => findLeadByProp(r.id));
    console.log(
      `--- [${activeMembers.length > 1 ? "MULTI-AKTIVNI" : "ok"}] kanon: ${canon.portalName} #${canon.id.slice(0, 8)} | ${canon.title} | ${canon.address ?? "?"} (${canon.area ?? "?"} m2, ${canon.price} Kc${canonLeads.length ? ", LEADS: " + canonLeads.map((l) => l.stage).join("+") : ""})`
    );
    for (const o of others) {
      const oLeads = findLeadByProp(o.id);
      console.log(
        `      duplicita: ${o.portalName} #${o.id.slice(0, 8)} | ${o.title} | ${o.address ?? "?"} (${o.area ?? "?"} m2, ${o.price} Kc${o.isActive === 1 ? ", AKTIVNI" : ""}${oLeads.length ? ", LEADS: " + oLeads.map((l) => l.stage).join("+") : ""})`
      );
      console.log(`        URL: ${o.url}`);
    }
    if (allLeadsInGroup.length > 1) {
      console.log(`      POZOR: leadu v skupine=${allLeadsInGroup.length} — slouci se do jednoho`);
    }

    if (!apply) continue;

    const canonDealCount = (
      await db.select({ id: deals.id }).from(deals).where(eq(deals.propertyId, canon.id))
    ).length;
    const canonAnalysis = await db
      .select({ id: propertyAnalysis.id })
      .from(propertyAnalysis)
      .where(eq(propertyAnalysis.propertyId, canon.id));

    for (const o of others) {
    try {
      // 1) leady duplicity → kanonik
      for (const lead of findLeadByProp(o.id)) {
        if (canonLeads.length === 0) {
          await db
            .update(leads)
            .set({ propertyId: canon.id, updatedAt: ts() })
            .where(eq(leads.id, lead.id));
          repointedLeads++;
          canonLeads.push(lead);
        } else {
          const winner = [...[canonLeads[0], lead]].sort(
            (a, b) => stageRank(b.stage) - stageRank(a.stage)
          )[0];
          const loser = winner.id === lead.id ? canonLeads[0] : lead;
          const winnerData = safeJsonParse<Record<string, unknown>>(
            typeof winner.stageData === "string" ? winner.stageData : null,
            {}
          );
          const loserData = safeJsonParse<Record<string, unknown>>(
            typeof loser.stageData === "string" ? loser.stageData : null,
            {}
          );
          const mergedData = { ...loserData, ...winnerData };
          const mergedNotes = [winner.notes, loser.notes].filter(Boolean).join("\n");
          await db
            .update(leads)
            .set({
              propertyId: canon.id,
              stage: winner.stage,
              stageData: JSON.stringify(mergedData),
              notes: mergedNotes || null,
              nextStep: winner.nextStep ?? loser.nextStep ?? null,
              nextStepDueAt: winner.nextStepDueAt ?? loser.nextStepDueAt ?? null,
              lostReason: winner.stage === "lost" ? (winner.lostReason ?? loser.lostReason ?? null) : null,
              priority: Math.max(winner.priority ?? 0, loser.priority ?? 0),
              portalStatus: winner.portalStatus ?? loser.portalStatus ?? null,
              portalReservedInvestorId: winner.portalReservedInvestorId ?? loser.portalReservedInvestorId ?? null,
              portalReservedModel: winner.portalReservedModel ?? loser.portalReservedModel ?? null,
              portalReservedStrategy: winner.portalReservedStrategy ?? loser.portalReservedStrategy ?? null,
              portalReservedAt: winner.portalReservedAt ?? loser.portalReservedAt ?? null,
              portalExpiresAt: winner.portalExpiresAt ?? loser.portalExpiresAt ?? null,
              stageEnteredAt: winner.stageEnteredAt ?? loser.stageEnteredAt ?? null,
              updatedAt: ts(),
            })
            .where(eq(leads.id, winner.id));
          await db.delete(leads).where(eq(leads.id, loser.id));
          mergedLeads++;
          deletedLeads++;
        }
      }

      // 2) dealy — presmeruj, pokud kanonik zadny nema
      const oDeals = await db.select({ id: deals.id }).from(deals).where(eq(deals.propertyId, o.id));
      for (const d of oDeals) {
        if (canonDealCount === 0) {
          await db.update(deals).set({ propertyId: canon.id }).where(eq(deals.id, d.id));
          canonDealCount++;
          console.log(`      deal ${d.id.slice(0, 8)} presmerovan na kanonika`);
        } else {
          console.log(`      POZOR: kanonik i duplicita maji deal — ruci kontrola: ${d.id.slice(0, 8)}`);
        }
      }

      // 3) analyza — presmeruj, pokud kanonik zadnou nema; jinak smaz
      const oAnalysis = await db
        .select({ id: propertyAnalysis.id })
        .from(propertyAnalysis)
        .where(eq(propertyAnalysis.propertyId, o.id));
      for (const a of oAnalysis) {
        if (canonAnalysis.length === 0) {
          await db.update(propertyAnalysis).set({ propertyId: canon.id }).where(eq(propertyAnalysis.id, a.id));
          canonAnalysis.push(a);
        } else {
          await db.delete(propertyAnalysis).where(eq(propertyAnalysis.id, a.id));
        }
      }

      // 4) price history — presmeruj vse
      await db.update(priceHistory).set({ propertyId: canon.id }).where(eq(priceHistory.propertyId, o.id));

      // 5) calculator presets — presmeruj vse
      await db
        .update(calculatorPresets)
        .set({ propertyId: canon.id })
        .where(eq(calculatorPresets.propertyId, o.id));

      // 6) favorites — presmeruj bez konfliktni duplicity
      const oFavs = await db
        .select({ userId: favorites.userId, propertyId: favorites.propertyId })
        .from(favorites)
        .where(eq(favorites.propertyId, o.id));
      const canonFavs = await db
        .select({ userId: favorites.userId })
        .from(favorites)
        .where(eq(favorites.propertyId, canon.id));
      const canonFavUsers = new Set(canonFavs.map((f) => f.userId));
      for (const f of oFavs) {
        if (canonFavUsers.has(f.userId)) continue;
        await db
          .insert(favorites)
          .values({ userId: f.userId, propertyId: canon.id, createdAt: ts() })
          .onConflictDoNothing();
        canonFavUsers.add(f.userId);
      }

      // 7) search properties — presmeruj bez konfliktni duplicity
      const oSps = await db
        .select({ searchId: searchProperties.searchId, propertyId: searchProperties.propertyId })
        .from(searchProperties)
        .where(eq(searchProperties.propertyId, o.id));
      for (const s of oSps) {
        await db
          .insert(searchProperties)
          .values({ searchId: s.searchId, propertyId: canon.id, firstSeen: ts(), lastSeen: ts() })
          .onConflictDoNothing();
      }

      // 8) realizovane prodeje — presmeruj vse
      await db
        .update(realizedSales)
        .set({ propertyId: canon.id })
        .where(eq(realizedSales.propertyId, o.id));

      // 9) history z duplicity vez pripne k kanonikovi
      await db
        .update(activityLog)
        .set({ propertyId: canon.id })
        .where(eq(activityLog.propertyId, o.id));

      // 10) slouceni do kanonickeho zaznamu (alt_portals + doplneni chybejicich udaju)
      const alts = appendAltPortal(parseAltPortals(canon.altPortals), o.portalName, o.url);
      canon.altPortals = toDbAltPortals(alts);
      const canonImgs = canon.imageUrls ? safeJsonParse<string[]>(canon.imageUrls, []) : [];
      const oImgs = o.imageUrls ? safeJsonParse<string[]>(o.imageUrls, []) : [];
      await db
        .update(properties)
        .set({
          altPortals: canon.altPortals,
          lastSeen: Math.max(canon.lastSeen ?? 0, o.lastSeen ?? 0),
          address: canon.address ?? o.address ?? null,
          rooms: canon.rooms ?? o.rooms ?? null,
          area: canon.area ?? o.area ?? null,
          floor: canon.floor ?? o.floor ?? null,
          condition: canon.condition ?? o.condition ?? null,
          buildingType: canon.buildingType ?? o.buildingType ?? null,
          yearBuilt: canon.yearBuilt ?? o.yearBuilt ?? null,
          lat: canon.lat ?? o.lat ?? null,
          lng: canon.lng ?? o.lng ?? null,
          contactPhone: canon.contactPhone ?? o.contactPhone ?? null,
          contactName: canon.contactName ?? o.contactName ?? null,
          contactEmail: canon.contactEmail ?? o.contactEmail ?? null,
          description: canon.description ?? o.description ?? null,
          imageUrls: JSON.stringify(oImgs.length > canonImgs.length ? oImgs : canonImgs),
        })
        .where(eq(properties.id, canon.id));
      canon.lastSeen = Math.max(canon.lastSeen ?? 0, o.lastSeen ?? 0);

      // 11) deaktivace duplicity
      await db
        .update(properties)
        .set({
          isActive: 0,
          status: PROPERTY_STATUS.REMOVED,
          removedAt: ts(),
        })
        .where(eq(properties.id, o.id));

      await db.insert(activityLog).values({
        id: generateId(),
        type: "scraping",
        message: `Sloucen do kanonickeho zaznamu (dedup backfill) - ${o.title}`,
        propertyId: canon.id,
        createdAt: ts(),
      });

      mergedRows++;
    } catch (e) {
      console.error(`      CHYBA u ${o.portalName} #${o.id.slice(0, 8)}: ${(e as Error).message} — preskoceno`);
    }
    }
  }

  if (apply) {
    console.log(`Sloucenych zaznamu: ${mergedRows}`);
    console.log(`Presmerovanych leadu: ${repointedLeads}`);
    console.log(`Sloucenych leadu (prepisu): ${mergedLeads}`);
    console.log(`Smazanych (duplicitnich) leadu: ${deletedLeads}`);
    if (mergedRows === 0) console.log("Nic ke slouceni.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});