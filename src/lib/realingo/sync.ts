import { ScrapingOrchestrator } from "@/lib/scraping/orchestrator";
import {
  fetchAllRealingoOffers,
  fetchPriceStatsByIds,
  toRawListing,
  DEFAULT_REALINGO_SEARCH,
  type RealingoSearchConfig,
} from "./offers";
import { fetchRealingoPagePhotos } from "./page-photos";
import { db } from "@/db";
import { realingoAccount, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts, safeJsonParse } from "@/lib/utils";

const ACCOUNT_ID = "primary";

export interface RealingoAccountConfig extends RealingoSearchConfig {
  enabled: boolean;
}

export async function getRealingoAccountConfig(): Promise<RealingoAccountConfig | null> {
  const row = await db
    .select()
    .from(realingoAccount)
    .where(eq(realingoAccount.id, ACCOUNT_ID))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  return {
    enabled: row.enabled === 1,
    address: row.address,
    purpose: row.purpose,
    property: row.property,
    buildingStatuses: safeJsonParse<string[]>(
      typeof row.buildingStatuses === "string" ? row.buildingStatuses : JSON.stringify(row.buildingStatuses ?? []),
      []
    ),
    sort: row.sort,
    first: row.first,
    maxAge: row.maxAge ?? null,
  };
}

/** Uloží konfiguraci Realingo (vytvoří row, pokud neexistuje). */
export async function saveRealingoAccountConfig(cfg: Partial<RealingoAccountConfig>): Promise<void> {
  const now = ts();
  const existing = await db
    .select({ id: realingoAccount.id })
    .from(realingoAccount)
    .where(eq(realingoAccount.id, ACCOUNT_ID))
    .limit(1)
    .then((r) => r[0]);

  // buildStatuses: sqlite = text (JSON string), pg = jsonb (akceptuje JSON string)
  const buildingStatuses = JSON.stringify(
    cfg.buildingStatuses ?? DEFAULT_REALINGO_SEARCH.buildingStatuses
  );
  const address = cfg.address ?? DEFAULT_REALINGO_SEARCH.address;
  const purpose = cfg.purpose ?? DEFAULT_REALINGO_SEARCH.purpose;
  const property = cfg.property ?? DEFAULT_REALINGO_SEARCH.property;
  const sort = cfg.sort ?? DEFAULT_REALINGO_SEARCH.sort;
  const first = cfg.first ?? DEFAULT_REALINGO_SEARCH.first;
  const maxAge = cfg.maxAge ?? null;
  const enabled = cfg.enabled ? 1 : 0;

  if (existing) {
    await db
      .update(realingoAccount)
      .set({
        enabled,
        address,
        purpose,
        property,
        buildingStatuses,
        sort,
        first,
        maxAge,
        updatedAt: now,
      } as never)
      .where(eq(realingoAccount.id, ACCOUNT_ID));
  } else {
    await db.insert(realingoAccount).values({
      id: ACCOUNT_ID,
      enabled,
      address,
      purpose,
      property,
      buildingStatuses,
      sort,
      first,
      maxAge,
      lastTotal: 0,
      lastLocked: 0,
      updatedAt: now,
    } as never);
  }
}

export interface RealingoSyncResult {
  scanned: number;
  saved: number;
  total: number;
  locked: number;
  errors: string[];
  /** false = vyčerpán časový budget, další cron pokračuje kde skončil (NEWEST řazení). */
  complete: boolean;
}

/**
 * Proveďte jeden sync pass z Realingo: vytáhne nabídky podle uložené konfigurace
 * (paginovaně, strop = config.first dříve jedné stránce 40), dodá cenový rating
 * (Valuo — pending stats se zkusí doplnit druhým collectem) a zapracuje je přes
 * stávající saveListing pipeline.
 */
export async function syncRealingo(): Promise<RealingoSyncResult> {
  const cfg = (await getRealingoAccountConfig()) ?? { ...DEFAULT_REALINGO_SEARCH, enabled: true };
  if (!cfg.enabled) {
    return { scanned: 0, saved: 0, total: 0, locked: 0, errors: ["Realingo disabled"], complete: true };
  }

  const errors: string[] = [];
  const started = Date.now();
  const fetched = await fetchAllRealingoOffers(cfg, {
    maxItems: cfg.first ?? DEFAULT_REALINGO_SEARCH.first,
    timeBudgetMs: 40_000,
  });
  const { items, total, lockedOffersCount, complete } = fetched;
  const stats = fetched.stats;

  // Valuo stats jsou za během asynchronní — nabídky bez labelu zkusí jeden
  // additional pass (denní cron to dotáhne i bez něj, update path rating
  // osvěží když přijde).
  const pendingIds = items
    .filter((i) => !stats.get(i.id)?.stats?.label)
    .map((i) => i.id);
  if (pendingIds.length > 0 && Date.now() - started < 50_000) {
    try {
      const refetch = await fetchPriceStatsByIds(pendingIds);
      for (const [k, v] of refetch) {
        if (v.stats?.label) stats.set(k, v);
      }
    } catch (e) {
      console.warn("[Realingo] stats refetch failed:", e);
    }
  }

  const listings = items.map((item) => {
    const stat = stats.get(item.id) ?? null;
    return toRawListing(item, stat, item.isLocked);
  });

  // Locked/předstih nabídky mají v searchOffer photos = null — fotky doplnit ze
  // veřejné HTML stránky nabídky (bez authu). Přísný budget: ingest i refetch
  // musí stihnout 60s serverless limit; řádky bez fotek dotáhne další cron
  // (saveListing update path fotky sloučí, když je feed nakonec vrátí).
  let photosBudget = 8;
  for (const listing of listings) {
    if (photosBudget <= 0 || Date.now() - started > 30_000) break;
    if (listing.imageUrls.length > 0) continue;
    photosBudget--;
    try {
      const imgs = await fetchRealingoPagePhotos(listing.url);
      if (imgs.length > 0) listing.imageUrls = imgs;
    } catch (e) {
      console.warn(`[Realingo] page photos failed (${listing.url}):`, e);
    }
  }

  const orchestrator = new ScrapingOrchestrator();
  const result = await orchestrator.ingestListings(listings);
  errors.push(...result.errors);

  // Zkontroluje, že na objektu existují sloupce (jsou v properties schema).
  const freshRealingoIds = new Set(items.map((i) => i.id));

  // Mark nabídky, které z Realingo zmizely, jako ne "předstih" (stale).
  // Jen při kompletním odběru — při časovém budgetu vidíme jen část feedu
  // a „neviděné" neznamená „zmizelé".
  if (complete && freshRealingoIds.size > 0) {
    const rows = await db
      .select({ id: properties.id, realingoId: properties.realingoId })
      .from(properties)
      .where(eq(properties.portalName, "realingo"));
    const stale = rows.filter((r) => r.realingoId && !freshRealingoIds.has(r.realingoId));
    for (const s of stale) {
      await db
        .update(properties)
        .set({ isEarlyOffer: 0 })
        .where(eq(properties.id, s.id));
    }
  }

  const now = ts();
  const status = {
    lastSyncAt: now,
    lastTotal: total,
    lastLocked: lockedOffersCount,
    lastError: errors.length ? errors.join("; ").slice(0, 500) : null,
    updatedAt: now,
  };
  // Row může neexistovat (setup nikdy nedokončen z UI) — bez insertu by se
  // stav/lastError ztratil v no-op UPDATE. Vytvořit ho s defaultami, se kterými sync běžel.
  const row = await db
    .select({ id: realingoAccount.id })
    .from(realingoAccount)
    .where(eq(realingoAccount.id, ACCOUNT_ID))
    .limit(1)
    .then((r) => r[0]);
  if (row) {
    await db.update(realingoAccount).set(status).where(eq(realingoAccount.id, ACCOUNT_ID)).catch(() => {});
  } else {
    await db
      .insert(realingoAccount)
      .values({
        id: ACCOUNT_ID,
        enabled: 1,
        address: cfg.address,
        purpose: cfg.purpose,
        property: cfg.property,
        buildingStatuses: JSON.stringify(cfg.buildingStatuses ?? []),
        sort: cfg.sort,
        first: cfg.first,
        maxAge: cfg.maxAge ?? null,
        ...status,
      } as never)
      .catch(() => {});
  }

  return {
    scanned: items.length,
    saved: result.total,
    total,
    locked: lockedOffersCount,
    errors,
    complete,
  };
}
