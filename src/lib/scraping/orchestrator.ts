import { PortalAdapter, CrawlStep } from "./adapters/base";
import { PortalName, PORTAL_CONFIGS, RawListing, SearchFilters, isValidPrice, filterImages } from "./types";
import { matchFilters, isCzechListing, isSaleListing } from "./filters";
import { applyAreaResolution } from "./area-resolver";
import { Deduplicator } from "./deduplicator";
import { db } from "@/db";
import { properties, propertyAnalysis, scrapingJobs, activityLog, priceHistory, searches, searchProperties, leads, realizedSales, crawlProgress } from "@/db/schema";
import { toRealizedSale } from "./sold-pairing";
import { eq, and, ne, notInArray, inArray, lte, gt, desc } from "drizzle-orm";
import { listingMatches, PROPERTY_STATUS, REMOVAL_GRACE_MS, type RelistCandidate } from "./relisting";
import { matchStrengthCrossPortal, isAutoMergeMatch, parseAltPortals, appendAltPortal, hasAltUrl, toDbAltPortals } from "./property-match";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { calculateFlipResults } from "@/lib/analysis/flip-costs";
import { generateId, ts, safeJsonParse } from "@/lib/utils";
import { checkPriceDropAlert, checkScoreThresholdAlert } from "@/lib/alert-matcher";
import { classifyLocation, findCityKey } from "@/lib/analysis/location";
import { getAnalysisRanges, refreshAllMarketData } from "@/lib/scraping/market-price-service";

/**
 * Vybere plnější titulek. bazos.cz ořezává titulky na 60 znaků (jeho limit —
 * plný text na jeho stránkách neexistuje), proto při sloučení se stejným
 * inzerátem z jiného portálu preferujeme nezkrácený titulek a nikdy
 * nedegradujeme plný titulek na ořezaný.
 */
function pickBetterTitle(
  current: string | null | undefined,
  incoming: string | null | undefined
): string | undefined {
  if (!incoming) return current ?? undefined;
  if (!current) return incoming;
  // Preferujeme delší (plnější) titulek — bazos.cz ořezává na 60 znaků,
  // plný text se objeví až při sloučení se stejným inzerátem z jiného portálu.
  return incoming.length > current.length ? incoming : current;
}

/**
 * Událost progressu pro hromadné hledání (streamované do UI přes SSE).
 * search-start → série portal událostí → search-done, pro každé hledání.
 */
export type ScrapeProgressEvent =
  | { kind: "search-start"; searchId: string; searchName: string; index: number; total: number }
  | { kind: "portal"; searchId: string; searchName: string; portal: PortalName; found: number; errors: string[] }
  | { kind: "search-done"; searchId: string; searchName: string; total: number; errors: string[] };

export class ScrapingOrchestrator {
  private adapters: Map<PortalName, PortalAdapter> = new Map();
  private deduplicator: Deduplicator = new Deduplicator();
  private onProgress?: (portal: PortalName, found: number, errors: string[]) => void;

  constructor(onProgress?: (portal: PortalName, found: number, errors: string[]) => void) {
    this.onProgress = onProgress;
  }

  registerAdapter(portalName: PortalName, adapter: PortalAdapter): void {
    this.adapters.set(portalName, adapter);
  }

  /**
   * Zapracuje seznam inzerátů (RawListing[]) přes kompletní saveListing pipeline
   * (dedup, cenová historie, re-listace, alerty, analýza). Používá se pro
   * externí zdroje, které nejdou skrz klasické portálové adaptéry — např. Realingo.
   */
  async ingestListings(
    listings: RawListing[],
    searchId?: string
  ): Promise<{ total: number; errors: string[] }> {
    let total = 0;
    const errors: string[] = [];
    for (const listing of listings) {
      if (this.deduplicator.isDuplicate(listing.url, listing.title)) continue;
      if (!isValidPrice(listing.price)) continue;
      if (!isSaleListing(listing)) continue;
      try {
        const propertyId = await this.saveListing(listing, searchId);
        if (propertyId) total++;
      } catch (err) {
        errors.push(`Failed to save listing ${listing.url}: ${err}`);
      }
    }
    return { total, errors };
  }

  async crawlAll(): Promise<{ total: number; errors: string[] }> {
    const portals = Object.keys(PORTAL_CONFIGS) as PortalName[];
    let total = 0;
    const allErrors: string[] = [];

    const crawlPortal = async (portal: PortalName): Promise<void> => {
      const adapter = this.adapters.get(portal);
      if (!adapter) return;
      if (!PORTAL_CONFIGS[portal].enabled) return;

      const errors: string[] = [];
      let found = 0;
      const foundUrls: Set<string> = new Set();

      const jobId = generateId();
      await db.insert(scrapingJobs).values({
        id: jobId,
        portal,
        status: "running",
        startedAt: ts(),
        createdAt: ts(),
      });

      try {
        const listings = await adapter.crawlListings();
        found = listings.length;

        for (const listing of listings) {
          if (this.deduplicator.isDuplicate(listing.url, listing.title)) continue;
          if (!isValidPrice(listing.price)) {
            errors.push(`Skipped listing with invalid price (${listing.price} Kc): ${listing.url}`);
            continue;
          }
          if (!isCzechListing(listing)) {
            errors.push(`Skipped foreign listing (${listing.address ?? "unknown address"}): ${listing.url}`);
            continue;
          }
          if (!isSaleListing(listing)) {
            errors.push(`Skipped non-sale listing (${listing.title ?? "no title"}): ${listing.url}`);
            continue;
          }

          foundUrls.add(listing.url);

          try {
            await this.saveListing(listing);
            total++;
          } catch (err) {
            errors.push(`Failed to save listing ${listing.url}: ${err}`);
          }
        }

        // Bulk deactivate stale listings not found in this crawl
        if (foundUrls.size > 0) {
          await db
            .update(properties)
            .set({ isActive: 0, lastSeen: ts() })
            .where(
              and(
                eq(properties.portalName, portal),
                eq(properties.isActive, 1),
                notInArray(properties.url, Array.from(foundUrls)),
              ),
            );
        }
        // Sloucené záznamy (stejná nemovitost z jiného portálu) se neodstraňují:
        // viditelná alt URL opět aktivuje kanonický řádek.
        await this.rescueDeactivatedByAltUrl(portal, foundUrls);
      } catch (err) {
        errors.push(`Crawl error (${portal}): ${err}`);
      }

      await db
        .update(scrapingJobs)
        .set({
          status: errors.length > 0 && found === 0 ? "failed" : "completed",
          finishedAt: ts(),
          listingsFound: found,
          errors: JSON.stringify(errors),
        })
        .where(eq(scrapingJobs.id, jobId));

      allErrors.push(...errors);
      if (this.onProgress) this.onProgress(portal, found, errors);

      await db.insert(activityLog).values({
        id: generateId(),
        type: "scraping",
        message: `Scraping ${portal} dokoncen (${found} inzeratu)`,
        data: JSON.stringify({ portal, found, errors: errors.length }),
        createdAt: ts(),
      });
    };

    const results = await Promise.allSettled(
      portals.map((portal) => crawlPortal(portal))
    );

    for (const result of results) {
      if (result.status === "rejected") {
        allErrors.push(`Portal crawl rejected: ${result.reason}`);
      }
    }

    await this.sweepRemovedListings().catch(() => {});

    return { total, errors: allErrors };
  }

  /**
   * Načte URL aktivních inzerátů z DB a nastaví je adaptérům jako
   * `skipDetailForUrls` — opakované běhy pak přeskočí drahé detail fetche
   * známých inzerátů (list stránka stačí na aktualizaci ceny/živosti).
   */
  private async loadKnownListingUrls(): Promise<void> {
    const rows = await db
      .select({ url: properties.url })
      .from(properties)
      .where(eq(properties.isActive, 1))
      .limit(20000);
    const urls = new Set(rows.map((r) => r.url));
    for (const adapter of this.adapters.values()) {
      adapter.skipDetailForUrls = urls;
      adapter.setKnownUrls?.(urls);
    }
  }

  async crawlSearch(
    searchId: string,
    filters: SearchFilters,
    opts?: { onPortalProgress?: (portal: PortalName, found: number, errors: string[]) => void }
  ): Promise<{ total: number; errors: string[] }> {
    // Načti známé URL jednou — adaptéry pak přeskočí detail fetche známých inzerátů.
    await this.loadKnownListingUrls().catch(() => {});

    // Mark as run immediately so UI shows something even if timeout happens later
    await db
      .update(searches)
      .set({ lastRunAt: ts() })
      .where(eq(searches.id, searchId));

    const portals = Object.keys(PORTAL_CONFIGS) as PortalName[];
    let total = 0;
    const allErrors: string[] = [];
    const allFoundUrls: Set<string> = new Set();

    const crawlPortal = async (portal: PortalName): Promise<void> => {
      const adapter = this.adapters.get(portal);
      if (!adapter) return;
      if (!PORTAL_CONFIGS[portal].enabled) return;

      const errors: string[] = [];
      let found = 0;

      try {
        const cityKey = filters.location ? findCityKey(filters.location) : null;
        let listings: RawListing[];
        if (cityKey && typeof adapter.crawlCityListings === "function") {
          listings = await adapter.crawlCityListings(cityKey);
        } else {
          listings = await adapter.crawlListings(filters);
        }
        listings = listings.filter((l) => matchFilters(l, filters) && isCzechListing(l) && isSaleListing(l));

        for (const listing of listings) {
          if (this.deduplicator.isDuplicate(listing.url, listing.title)) continue;
          if (!isValidPrice(listing.price)) continue;

          allFoundUrls.add(listing.url);

          try {
            const propertyId = await this.saveListing(listing, searchId);
            if (propertyId) {
              total++;
              found++;
            }
          } catch (err) {
            errors.push(`Failed to save listing ${listing.url}: ${err}`);
          }
        }
      } catch (err) {
        errors.push(`Crawl error (${portal}): ${err}`);
      }

      allErrors.push(...errors);
      opts?.onPortalProgress?.(portal, found, errors);
    };

    const results = await Promise.allSettled(
      portals.map((portal) => crawlPortal(portal))
    );

    for (const result of results) {
      if (result.status === "rejected") {
        allErrors.push(`Portal crawl rejected: ${result.reason}`);
      }
    }

    // Cleanup: remove search property links for listings no longer matching filters.
    // Only when the crawl completed without errors - a failed portal would otherwise
    // wipe out links to listings that are still live (e.g. page 2+ or temporarily down).
    if (allErrors.length === 0 && allFoundUrls.size > 0) {
      try {
        const linked = await db
          .select({ id: properties.id, url: properties.url, altPortals: properties.altPortals })
          .from(searchProperties)
          .innerJoin(properties, eq(searchProperties.propertyId, properties.id))
          .where(eq(searchProperties.searchId, searchId));

        const staleIds = linked
          .filter(
            (l) =>
              !allFoundUrls.has(l.url) &&
              // Sloucené záznamy žijou dál, pokud byla viděna jejich alt URL.
              !parseAltPortals(l.altPortals).some((a) => allFoundUrls.has(a.url))
          )
          .map((l) => l.id);

        if (staleIds.length > 0) {
          await db
            .delete(searchProperties)
            .where(
              and(
                eq(searchProperties.searchId, searchId),
                inArray(searchProperties.propertyId, staleIds),
              ),
            );

          // Deaktivuj inzeráty, které z portálu zmizely a už nejsou navázané
          // na žádné další hledání (jinak zůstávají v databázi jako "aktivní"
          // navěky). Napojení na jiné hledání je ochrání před deaktivací.
          const stillLinked = await db
            .select({ propertyId: searchProperties.propertyId })
            .from(searchProperties)
            .where(inArray(searchProperties.propertyId, staleIds));
          const stillLinkedSet = new Set(stillLinked.map((l) => l.propertyId));
          const toDeactivate = staleIds.filter((id) => !stillLinkedSet.has(id));

          if (toDeactivate.length > 0) {
            await db
              .update(properties)
              .set({ isActive: 0, lastSeen: ts() })
              .where(inArray(properties.id, toDeactivate));
          }
        }
      } catch (err) {
        allErrors.push(`Search link cleanup error: ${err}`);
      }
    }

    await this.sweepRemovedListings().catch(() => {});

    return { total, errors: allErrors };
  }

  async crawlAllScheduled(): Promise<void> {
    const now = Date.now();
    const scheduled = await db
      .select()
      .from(searches)
      .where(ne(searches.schedule, "manual"))

    for (const search of scheduled) {
      if (search.lastRunAt) {
        const intervalMs = search.schedule === "weekly" ? 604800000 : 86400000;
        if (now - search.lastRunAt < intervalMs) continue;
      }

      let filters: SearchFilters = {};
      try {
        filters = JSON.parse(search.filters) as SearchFilters;
      } catch {
        continue;
      }

      try {
        await this.crawlSearch(search.id, filters);
      } catch (err) {
        console.error(`[scraping] Scheduled search ${search.id} (${search.name}) failed:`, err);
      }
    }

    // Refresh market price cache after all searches complete
    refreshAllMarketData().catch(() => {});

    await this.sweepRemovedListings().catch(() => {});
  }

  /**
   * Hromadné hledání — všechna hledání uživatele najednou.
   *
   * Načte známé URL z DB (skipDetailForUrls), takže opakované běhy přeskočí
   * drahé detail fetche známých inzerátů. Portály, které neumí městský crawl,
   * se crawlejí JEDNOU a výsledky se sdílí mezi všemi hledáními (dřív se
   * každé hledání crawlovalo znovu — 6 hledání = 6× celá ČR). City-scoped
   * portály (sreality, realitymat, idnes) se crawlejí jednou na město.
   * `skipPortals` umožňuje pokračovat na úrovni portálu (auto-pokračování po
   * 60s limitu) — dokončené portály se přeskočí, místo restartu od nuly.
   */
  async crawlAllForUser(
    userId: string,
    opts?: {
      onProgress?: (event: ScrapeProgressEvent) => void;
      /** Hledání, která už proběhla v předchozím běhu (auto-pokračování po
       *  60s limitu) — spustí se jen zbývající, takže se zbytek dojede sám. */
      skipSearchIds?: string[];
      /** Portály už dokončené pro dané hledání (auto-pokračování) — přeskočí se. */
      skipPortals?: Record<string, PortalName[]>;
      /** Časový strop běhu v ms (Vercel limit 60 s) — výchozí 45 s práce,
       *  zbytek je rezerva na ukládání a odeslání done události. */
      budgetMs?: number;
    }
  ): Promise<{ total: number; runCount: number; failed: string[]; incomplete: boolean }> {
    const userSearches = await db
      .select()
      .from(searches)
      .where(eq(searches.userId, userId));

    const skip = new Set(opts?.skipSearchIds ?? []);
    const skipPortals = opts?.skipPortals ?? {};
    const pending = userSearches.filter((s) => !skip.has(s.id));

    const totalSearches = userSearches.length;
    let total = 0;
    let runCount = 0;
    const failed: string[] = [];
    // Hledání, která nemají všechny portály dokončené (limit 60 s) — nedostanou
    // search-done, takže je client nepřeskočí a dojedou se příštím během.
    const incompleteSearches = new Set<string>();

    if (pending.length === 0) return { total, runCount, failed, incomplete: false };

    // Časový strop běhu. Vercel Hobby = 60 s; 45 s crawlu + ~15 s rezerva
    // na ukládání výsledků a odeslání done události.
    const budgetMs = opts?.budgetMs ?? 45_000;
    const deadline = Date.now() + budgetMs;

    // Načti známé URL jednou — adaptéry pak přeskočí detail fetche známých inzerátů.
    await this.loadKnownListingUrls().catch(() => {});

    // Rozparsuj filtry dopředu.
    const parsed = pending.map((search) => {
      let filters: SearchFilters = {};
      try {
        filters = JSON.parse(search.filters) as SearchFilters;
      } catch {
        // neplatné filtry — ošetřeno níže
      }
      return {
        search,
        filters,
        cityKey: filters.location ? findCityKey(filters.location) : null,
        locationText: filters.location?.trim() ?? null,
      };
    });

    const portals = (Object.keys(PORTAL_CONFIGS) as PortalName[]).filter((p) => PORTAL_CONFIGS[p].enabled);

    // City-scoped portály (mají crawlCityListings nebo staví URL podle města)
    // se crawlejí jednou na město. Ostatní (celá ČR, filtr až v matchFilters)
    // se crawlejí jednou a sdílí mezi všemi hledáními.
    const uniqueCities = [...new Set(parsed.map((p) => p.cityKey).filter((c): c is string => !!c))];
    const hasCityless = parsed.some((p) => !p.cityKey);

    interface CrawlJob {
      portal: PortalName;
      cityKey: string | null;
      /** Původní text lokace (idnes ho potřebuje pro URL — cityKey má jiný tvar). */
      locationText?: string | null;
      searches: typeof parsed;
    }
    const jobs: CrawlJob[] = [];

    for (const portal of portals) {
      const adapter = this.adapters.get(portal);
      if (!adapter) continue;
      const cityScoped =
        typeof adapter.crawlCityListings === "function" || portal === "idnes-reality";

      if (cityScoped) {
        for (const city of uniqueCities) {
          jobs.push({
            portal,
            cityKey: city,
            // idnes staví URL z filtru location — pošleme mu původní text („Brno"),
            // ne cityKey („brno") — slugifyCity v adaptéru čeká lidský název.
            locationText: parsed.find((p) => p.cityKey === city)?.locationText ?? null,
            searches: parsed.filter((p) => p.cityKey === city),
          });
        }
        if (hasCityless) {
          jobs.push({ portal, cityKey: null, searches: parsed.filter((p) => !p.cityKey) });
        }
      } else {
        jobs.push({ portal, cityKey: null, searches: parsed });
      }
    }

    // search-start pro všechna hledání (i přeskočená — client si je pamatuje).
    parsed.forEach((p, index) => {
      opts?.onProgress?.({
        kind: "search-start",
        searchId: p.search.id,
        searchName: p.search.name,
        index,
        total: totalSearches,
      });
    });

    // Průběžné součty per hledání (pro search-done události).
    const searchTotals = new Map<string, number>();
    const searchErrors = new Map<string, string[]>();

    const results = await Promise.allSettled(
      jobs.map(async (job) => {
        const adapter = this.adapters.get(job.portal);
        if (!adapter) return;

        // Potřebují toto (portál, město) ještě nějaká hledání? Všechna už mají
        // portál hotový → přeskoč crawl úplně.
        const needed = job.searches.filter(
          (p) => !(skipPortals[p.search.id] ?? []).includes(job.portal)
        );
        if (needed.length === 0) return;

        const errors: string[] = [];
        const progressId = `${job.portal}:${job.cityKey ?? ""}`;

        // Poslední dokončený krok (stránka) z předchozích běhů — přeskočí se,
        // aby auto-pokračování navazovalo místo restartu od nuly.
        let startStep = 0;
        try {
          const row = await db
            .select({ step: crawlProgress.step })
            .from(crawlProgress)
            .where(eq(crawlProgress.id, progressId))
            .limit(1)
            .then((r) => r[0]);
          startStep = row?.step ?? 0;
        } catch {
          // crawl_progress tabulka nemusí existovat (stará DB) — pokračuj od nuly.
        }

        const ctx: CrawlStep = {
          startStep,
          deadlineMs: deadline,
          completed: true,
          onStepDone: (step) => {
            // Best-effort persist — ztracený krok = jen přeskočená stránka příště.
            void db
              .insert(crawlProgress)
              .values({
                id: progressId,
                portal: job.portal,
                city: job.cityKey ?? "",
                step: step + 1,
                updatedAt: ts(),
              })
              .onConflictDoUpdate({
                target: crawlProgress.id,
                set: { step: step + 1, updatedAt: ts() },
              })
              .catch(() => {});
          },
        };

        let listings: RawListing[] = [];
        try {
          if (job.cityKey && typeof adapter.crawlCityListings === "function") {
            listings = await adapter.crawlCityListings(job.cityKey, undefined, ctx);
          } else if (job.portal === "idnes-reality") {
            listings = await adapter.crawlListings(
              job.locationText ? { location: job.locationText } : undefined,
              ctx
            );
          } else {
            listings = await adapter.crawlListings(
              job.cityKey ? { location: job.cityKey } : undefined,
              ctx
            );
          }
        } catch (err) {
          errors.push(`Crawl error (${job.portal}): ${err}`);
        }

        // Běž skončil předčasně (deadline) → portál se dojede příštím během:
        // progress řádek zůstává v DB, hledání nedostane search-done (client
        // ho nepřeskočí) a portál dostane chybu (client ho taky nepřeskočí).
        // Uložené částečné výsledky se přitom normálně projeví.
        if (!ctx.completed) {
          errors.push("Běž přerušen limitem 60 s — portál se dojede příštím během");
          for (const p of needed) incompleteSearches.add(p.search.id);
        } else {
          // Portál dokončen → progress záznam už netřeba.
          void db.delete(crawlProgress).where(eq(crawlProgress.id, progressId)).catch(() => {});
        }

        // Dedup URL v rámci jednoho crawlu (paginace vrací duplicity).
        const seen = new Set<string>();
        const unique = listings.filter((l) => {
          if (seen.has(l.url)) return false;
          seen.add(l.url);
          return true;
        });

        // Distribuuj výsledky hledáním, která tenhle (portál, město) potřebují.
        for (const { search, filters } of needed) {
          if ((skipPortals[search.id] ?? []).includes(job.portal)) continue;

          const portalErrors = [...errors];
          const matched = filters
            ? unique.filter(
                (l) =>
                  matchFilters(l, filters) && isCzechListing(l) && isSaleListing(l) && isValidPrice(l.price)
              )
            : [];

          let found = 0;
          for (const listing of matched) {
            // Ukládání je pomalé (analýza + tržní data) — když je deadline za
            // námi, necháme zbytek na příštím běhu, ať stihneme done událost
            // v limitu 60 s. Portál se tím označí jako neúplný (viz níže).
            if (Date.now() >= deadline) {
              if (ctx.completed) {
                // Crawl deadline stihl, ale ukládání už ne — portál se dojede
                // příštím během, jinak by zbylé inzeráty nikdy nespadly do DB.
                ctx.completed = false;
                portalErrors.push("Běž přerušen limitem 60 s — portál se dojede příštím během");
                incompleteSearches.add(search.id);
              }
              break;
            }
            try {
              const propertyId = await this.saveListing(listing, search.id);
              if (propertyId) {
                found++;
                total++;
                searchTotals.set(search.id, (searchTotals.get(search.id) ?? 0) + 1);
              }
            } catch (err) {
              portalErrors.push(`Failed to save listing ${listing.url}: ${err}`);
            }
          }

          searchErrors.set(search.id, [...(searchErrors.get(search.id) ?? []), ...portalErrors]);
          opts?.onProgress?.({
            kind: "portal",
            searchId: search.id,
            searchName: search.name,
            portal: job.portal,
            found,
            errors: portalErrors,
          });
        }
      })
    );

    for (const result of results) {
      if (result.status === "rejected") failed.push(`Crawl selhal: ${result.reason}`);
    }

    // search-done jen pro hledání s dokončenými portály — nedokončená (limit
    // 60 s) client nepřeskočí a dojedou se příštím během.
    for (const { search, filters } of parsed) {
      if (incompleteSearches.has(search.id)) continue;
      runCount++;
      if (!filters) {
        failed.push(`Search ${search.id} (${search.name}): invalid filters`);
      }
      opts?.onProgress?.({
        kind: "search-done",
        searchId: search.id,
        searchName: search.name,
        total: searchTotals.get(search.id) ?? 0,
        errors: searchErrors.get(search.id) ?? [],
      });
    }

    // Refresh tržních dat sem nepatří — Tier 3 sampling (až 80 sreality fetchů)
    // by spálil zbývající čas a běh by nestihl done událost. Patří do plánované
    // úlohy (crawlAllScheduled).
    if (Date.now() < deadline) {
      await this.sweepRemovedListings().catch(() => {});
    }

    return { total, runCount, failed, incomplete: incompleteSearches.size > 0 };
  }

  private async saveListing(
    listing: RawListing,
    searchId?: string
  ): Promise<string | null> {
    if (!isSaleListing(listing)) {
      console.log(`Skipped non-sale listing (${listing.title}): ${listing.url}`);
      return null;
    }

    const { resolved: resolvedListing, accessoryArea, flag } = applyAreaResolution(listing);
    listing = resolvedListing;

    const hash = this.deduplicator.hash(listing.url, listing.title);

    const existing = await db
      .select()
      .from(properties)
      .where(eq(properties.url, listing.url))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      // Inzerát se vrací — byl označen jako odstraněný, portál ho naho koval zpět.
      if (existing.status === PROPERTY_STATUS.REMOVED || existing.removedAt != null) {
        await db.insert(activityLog).values({
          id: generateId(),
          type: "scraping",
          message: `Inzerat znovu nahozen - ${listing.title}`,
          propertyId: existing.id,
          createdAt: ts(),
        });
        // Inzerát se vrátil → nebyl prodán → zruš párování na realizovaný prodej.
        await db.delete(realizedSales).where(eq(realizedSales.propertyId, existing.id));
      }

      // Check for price change
      if (existing.price !== listing.price) {
        await db.insert(priceHistory).values({
          id: generateId(),
          propertyId: existing.id,
          price: listing.price,
          recordedAt: ts(),
        });

        // Log price drop activity and check alerts
        if (listing.price < existing.price) {
          const dropPct = ((existing.price - listing.price) / existing.price) * 100;
          await db.insert(activityLog).values({
            id: generateId(),
            type: "price",
            message: `Snizeni ceny o ${dropPct.toFixed(1)}% - ${listing.title}`,
            propertyId: existing.id,
            createdAt: ts(),
          });

          await checkPriceDropAlert(existing.id, listing.title, listing.url, existing.price, listing.price).catch(() => {});
        }
      }
      const area = existing.area ?? listing.area ?? 70;
      const keepManualArea = existing.areaLocked === 1 && existing.area != null;
      const effectiveArea = keepManualArea ? existing.area : (listing.area ?? existing.area);
      const effectivePricePerSqm =
        keepManualArea && (effectiveArea ?? 0) > 0
          ? Math.round(listing.price / (effectiveArea as number))
          : listing.pricePerSqm;

      await db
        .update(properties)
        .set({
          title: pickBetterTitle(existing.title, listing.title),
          price: listing.price,
          pricePerSqm: effectivePricePerSqm,
          area: effectiveArea,
          floorArea: listing.floorArea ?? existing.floorArea ?? null,
          usableArea: listing.usableArea ?? existing.usableArea ?? null,
          accessoryArea: accessoryArea ?? existing.accessoryArea ?? null,
          areaFlag: flag ?? existing.areaFlag ?? null,
          rooms: listing.rooms ?? existing.rooms,
          floor: listing.floor ?? existing.floor,
          condition: listing.condition ?? existing.condition,
          buildingType: listing.buildingType ?? existing.buildingType,
          yearBuilt: listing.yearBuilt ?? existing.yearBuilt,
          address: listing.address ?? existing.address,
          lat: listing.lat ?? existing.lat,
          lng: listing.lng ?? existing.lng,
          contactPhone: listing.contactPhone ?? existing.contactPhone,
          contactName: listing.contactName ?? existing.contactName,
          contactEmail: listing.contactEmail ?? existing.contactEmail,
          description: listing.description ?? existing.description,
          imageUrls: JSON.stringify(
            (() => {
              const newImgs = filterImages(listing.imageUrls, listing.portalName);
              const oldImgs: string[] = existing.imageUrls ? safeJsonParse<string[]>(existing.imageUrls, []) : [];
              return newImgs.length >= oldImgs.length ? newImgs : oldImgs;
            })()
          ),
          lastSeen: ts(),
          isActive: 1,
          status: PROPERTY_STATUS.ACTIVE,
          removedAt: null,
          realingoId: listing.realingoId ?? existing.realingoId ?? null,
          priceRating: listing.priceRating ?? existing.priceRating ?? null,
          priceTier: listing.priceTier ?? existing.priceTier ?? null,
          priceRatingJson: listing.priceRatingJson ?? existing.priceRatingJson ?? null,
          isEarlyOffer: listing.isEarlyOffer != null ? (listing.isEarlyOffer ? 1 : 0) : (existing.isEarlyOffer ?? 0),
          realingoSyncedAt: listing.realingoId != null ? ts() : (existing.realingoSyncedAt ?? null),
        })
        .where(eq(properties.id, existing.id));

      // Re-analyze only on price change
      if (existing.price !== listing.price) {
        const renoCostEstimate = Math.round(area * 10000) + 180000 + 140000;
        const existingAnalysis = await db
          .select({ arv: propertyAnalysis.arv, investmentScore: propertyAnalysis.investmentScore })
          .from(propertyAnalysis)
          .where(eq(propertyAnalysis.propertyId, existing.id))
          .limit(1)
          .then((r) => r[0]);
        const estimatedArv = existingAnalysis?.arv ?? Math.round(listing.price * 1.15);
        const freshAnalysis = calculateFlipResults(listing.price, estimatedArv, renoCostEstimate, area, 15);
        await db
          .update(propertyAnalysis)
          .set({
            arv: estimatedArv,
            totalCost: freshAnalysis.costs.totalCost,
            netProfit: freshAnalysis.netProfit,
            roi: freshAnalysis.roi,
            annualizedRoi: freshAnalysis.annualizedRoi,
            cashOnCash: freshAnalysis.cashOnCash,
            targetPurchasePrice: freshAnalysis.targetPurchasePrice,
            costsJson: JSON.stringify(freshAnalysis.costs),
            updatedAt: ts(),
          })
          .where(eq(propertyAnalysis.propertyId, existing.id));

        // AI hodnocení se negeneruje při crawlu — generuje se on-demand
        // tlačítkem v detailu nemovitosti (kvóta Gemini free tieru je omezená).
        await checkScoreThresholdAlert(existing.id, listing.title, listing.url, existingAnalysis?.investmentScore ?? null).catch(() => {});
      }

      if (searchId) {
        const alreadyLinked = await db
          .select()
          .from(searchProperties)
          .where(and(eq(searchProperties.searchId, searchId), eq(searchProperties.propertyId, existing.id)))
          .limit(1)
          .then((r) => r[0]);

        if (!alreadyLinked) {
        await db.insert(searchProperties).values({
          searchId,
          propertyId: existing.id,
          firstSeen: ts(),
          lastSeen: ts(),
        });
        }
      }

      return existing.id;
    } else {
      // Nová URL — možná je to re-listace (inzerát nahozený znovu pod jinou URL).
      const relisted = await this.findRelistedProperty(listing);
      if (relisted) {
        // Inzerát se vrátil pod novou URL → nebyl prodán → zruš párování na prodej.
        await db.delete(realizedSales).where(eq(realizedSales.propertyId, relisted.id));
        // Přesuneme záznam na novou URL a oživíme ho; zbytek (cena, analýza,
        // linky) dořeší opětovný vstup do existující větve saveListing.
        await db
          .update(properties)
          .set({
            url: listing.url,
            portalId: `${listing.portalName}_${hash.slice(0, 8)}`,
            isActive: 1,
            status: PROPERTY_STATUS.ACTIVE,
            removedAt: null,
            lastSeen: ts(),
          })
          .where(eq(properties.id, relisted.id));

        await db.insert(activityLog).values({
          id: generateId(),
          type: "scraping",
          message: `Inzerat znovu nahozen (nova URL) - ${listing.title}`,
          propertyId: relisted.id,
          createdAt: ts(),
        });

        return this.saveListing(listing, searchId);
      }

      // Stejná nemovitost už je v databázi z jiného portálu → sloučíme místo nového řádku.
      const merged = await this.findCrossPortalProperty(listing);
      if (merged) {
        return this.mergeExistingWithCrossPortal(merged, listing, searchId);
      }

      // Insert new property
      const id = generateId();
      await db.insert(properties).values({
        id,
        portalId: `${listing.portalName}_${hash.slice(0, 8)}`,
        portalName: listing.portalName,
        url: listing.url,
        title: listing.title,
        price: listing.price,
        pricePerSqm: listing.pricePerSqm,
        area: listing.area,
        floorArea: listing.floorArea ?? null,
        usableArea: listing.usableArea ?? null,
        accessoryArea: accessoryArea ?? null,
        areaFlag: flag ?? null,
        rooms: listing.rooms,
        floor: listing.floor,
        condition: listing.condition,
        buildingType: listing.buildingType,
        yearBuilt: listing.yearBuilt,
        address: listing.address,
        lat: listing.lat,
        lng: listing.lng,
        contactPhone: listing.contactPhone,
        contactName: listing.contactName,
        contactEmail: listing.contactEmail,
        description: listing.description,
        imageUrls: JSON.stringify(filterImages(listing.imageUrls, listing.portalName)),
        status: "active",
        firstSeen: listing.publishedAt ? new Date(listing.publishedAt).getTime() : ts(),
        lastSeen: ts(),
        isActive: 1,
        realingoId: listing.realingoId ?? null,
        priceRating: listing.priceRating ?? null,
        priceTier: listing.priceTier ?? null,
        priceRatingJson: listing.priceRatingJson ?? null,
        isEarlyOffer: listing.isEarlyOffer ? 1 : 0,
        realingoSyncedAt: listing.realingoId != null ? ts() : null,
      });

      // Initial price record
      await db.insert(priceHistory).values({
        id: generateId(),
        propertyId: id,
        price: listing.price,
        recordedAt: listing.publishedAt ? new Date(listing.publishedAt).getTime() : ts(),
      });

      // Enhanced analysis with live market data. Během crawlu se Tier 3
      // (až 80 sreality fetchů na nový inzerát) nepouští — limit 60 s by
      // nestihl ani jeden saveListing. Tržní data se doberou plánovanou
      // úlohou (refreshAllMarketData s live režimem).
      const location = classifyLocation(listing.address, listing.title);
      const ranges = location.city !== "Neznámá"
        ? await getAnalysisRanges({
            cityKey: location.city,
            lat: listing.lat,
            lng: listing.lng,
            condition: listing.condition,
            buildingType: listing.buildingType,
            area: listing.area,
            category: location.category,
          }, false).catch(() => ({ dynamicRange: null, arvRange: null }))
        : { dynamicRange: null, arvRange: null };
      const analysis = analyzeListing(listing, ranges.dynamicRange, undefined, location, ranges.arvRange);

      // AI hodnocení se negeneruje při crawlu — generuje se on-demand
      // tlačítkem v detailu nemovitosti (kvóta Gemini free tieru je omezená).
      await db.insert(propertyAnalysis).values({
        id: generateId(),
        propertyId: id,
        marketValue: analysis.arv,
        undervaluationPct: analysis.undervaluationPct,
        investmentScore: analysis.investmentScore,
        arv: analysis.arv,
        renovationCost: analysis.costs.renovationCost,
        totalCost: analysis.costs.totalCost,
        netProfit: analysis.netProfit,
        roi: analysis.roi,
        annualizedRoi: analysis.annualizedRoi,
        cashOnCash: analysis.cashOnCash,
        breakEvenPrice: analysis.breakEvenPrice,
        targetPurchasePrice: analysis.targetPurchasePrice,
        recommendation: analysis.recommendation,
        // Nova rozsirena pole
        pricePerSqm: analysis.pricePerSqm,
        marketPriceMin: analysis.marketPricePerSqmLow,
        marketPriceMax: analysis.marketPricePerSqmHigh,
        arvPricePerSqmHigh: analysis.arvPricePerSqmHigh,
        marketSource: ranges.dynamicRange?.source ?? null,
        marketSampleSize: ranges.dynamicRange?.sampleSize ?? null,
        overpricingPct: analysis.overpricingPct,
        locationCategory: analysis.location.category,
        locationCity: analysis.location.city,
        locationDistrict: analysis.location.district,
        segmentRating: analysis.segmentRating,
        occupancy: analysis.occupancy,
        buildingType: analysis.buildingType,
        energyLabel: analysis.energyLabel,
        technicalScore: analysis.technicalScore,
        verdictLevel: analysis.verdictLevel,
        verdictSummary: analysis.verdictSummary,
        redFlagsJson: JSON.stringify(analysis.redFlags),
        costsJson: JSON.stringify(analysis.costs),
        alternativeStrategiesJson: JSON.stringify(analysis.alternativeStrategies),
        rentalYield: analysis.rentalYield,
        createdAt: ts(),
        updatedAt: ts(),
      });



      await db.insert(activityLog).values({
        id: generateId(),
        type: "new_property",
        message: `Nalezen novy inzerat - ${listing.title}`,
        propertyId: id,
        createdAt: ts(),
      });

      if (searchId) {
        await db.insert(searchProperties).values({
          searchId,
          propertyId: id,
          firstSeen: ts(),
          lastSeen: ts(),
        });
      }

      await checkScoreThresholdAlert(id, listing.title, listing.url, analysis.investmentScore).catch(() => {});

      return id;
    }
  }

  // Cross-portal shoda: stejná nemovitost inzerovaná na jiném portálu (jiná URL)
  // se nesmí stát novým řádkem — vrací kanonický záznam, pokud se obsahově shoduje.
  private async findCrossPortalProperty(listing: RawListing): Promise<typeof properties.$inferSelect | null> {
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    // Prohlížení 2000 řádků na JEDEN nový inzerát bylo drahé (až 6+ dotazů
    // napříč celou DB v saveListing) — aktivní kandidáti stačí, 300 je
    // kompromis mezi rychlostí a přesností sloučení.
    const rows = await db
      .select()
      .from(properties)
      .where(gt(properties.lastSeen, cutoff))
      .orderBy(desc(properties.isActive), desc(properties.lastSeen))
      .limit(300);

    let best: typeof properties.$inferSelect | null = null;
    for (const row of rows) {
      if (row.url === listing.url) continue;
      if (hasAltUrl(row.altPortals, listing.url)) continue;
      const match = matchStrengthCrossPortal(
        {
          portalName: listing.portalName,
          title: listing.title,
          address: listing.address ?? null,
          rooms: listing.rooms ?? null,
          area: listing.area ?? null,
          price: listing.price,
        },
        {
          id: row.id,
          portalName: row.portalName,
          title: row.title,
          address: row.address,
          rooms: row.rooms,
          area: row.area,
          price: row.price,
          lastSeen: row.lastSeen,
          isActive: row.isActive,
        }
      );
      if (!isAutoMergeMatch(match)) continue;
      if (!best) {
        best = row;
        continue;
      }
      const aScore = (best.isActive === 1 ? 1 : 0) * 1e9 + (best.lastSeen ?? 0);
      const bScore = (row.isActive === 1 ? 1 : 0) * 1e9 + (row.lastSeen ?? 0);
      if (bScore > aScore) best = row;
    }
    return best;
  }

  // Sloučí inzerát z jiného portálu do kanonického záznamu: sekundární URL
  // do alt_portals, oživení, doplnění chybějících údajů + navázání na hledání.
  private async mergeExistingWithCrossPortal(
    existing: typeof properties.$inferSelect,
    listing: RawListing,
    searchId?: string
  ): Promise<string> {
    const alts = appendAltPortal(parseAltPortals(existing.altPortals), listing.portalName, listing.url);

    const oldImgs: string[] = existing.imageUrls ? safeJsonParse<string[]>(existing.imageUrls, []) : [];
    const newImgs = filterImages(listing.imageUrls ?? [], listing.portalName);
    const imgs = newImgs.length > oldImgs.length ? newImgs : oldImgs;

    await db
      .update(properties)
      .set({
        altPortals: toDbAltPortals(alts),
        // Preferujeme plnější titulek (bazos ořezává na 60 znaků).
        title: pickBetterTitle(existing.title, listing.title),
        isActive: 1,
        status: PROPERTY_STATUS.ACTIVE,
        removedAt: null,
        lastSeen: ts(),
        // Doplníme jen chybějící údaje — cena/plocha zůstávají kanonické.
        rooms: existing.rooms ?? listing.rooms ?? null,
        floor: existing.floor ?? listing.floor ?? null,
        condition: existing.condition ?? listing.condition ?? null,
        buildingType: existing.buildingType ?? listing.buildingType ?? null,
        yearBuilt: existing.yearBuilt ?? listing.yearBuilt ?? null,
        address: existing.address ?? listing.address ?? null,
        lat: existing.lat ?? listing.lat ?? null,
        lng: existing.lng ?? listing.lng ?? null,
        contactPhone: existing.contactPhone ?? listing.contactPhone ?? null,
        contactName: existing.contactName ?? listing.contactName ?? null,
        contactEmail: existing.contactEmail ?? listing.contactEmail ?? null,
        description: existing.description ?? listing.description ?? null,
        imageUrls: JSON.stringify(imgs),
      })
      .where(eq(properties.id, existing.id));

    // Zruš párování na prodej, pokud byl záznam označen jako odstraněný.
    if (existing.status === PROPERTY_STATUS.REMOVED || existing.removedAt != null) {
      await db.delete(realizedSales).where(eq(realizedSales.propertyId, existing.id));
    }

    await db.insert(activityLog).values({
      id: generateId(),
      type: "scraping",
      message: `Inzerat sloucen z dalsiho portalu - ${listing.title}`,
      propertyId: existing.id,
      createdAt: ts(),
    });

    if (searchId) {
      const alreadyLinked = await db
        .select()
        .from(searchProperties)
        .where(and(eq(searchProperties.searchId, searchId), eq(searchProperties.propertyId, existing.id)))
        .limit(1)
        .then((r) => r[0]);
      if (!alreadyLinked) {
        await db.insert(searchProperties).values({
          searchId,
          propertyId: existing.id,
          firstSeen: ts(),
          lastSeen: ts(),
        });
      }
    }

    return existing.id;
  }

  // Znovu aktivuje deaktivované řádky, jejichž alt URL byla v tomto běhu viděna.
  private async rescueDeactivatedByAltUrl(portal: string, foundUrls: Set<string>): Promise<void> {
    if (foundUrls.size === 0) return;
    const rows = await db
      .select({ id: properties.id, altPortals: properties.altPortals })
      .from(properties)
      .where(and(eq(properties.portalName, portal), eq(properties.isActive, 0)))
      .limit(2000);

    const toRescue = rows.filter((r) => parseAltPortals(r.altPortals).some((a) => foundUrls.has(a.url)));
    if (toRescue.length === 0) return;

    await db
      .update(properties)
      .set({ isActive: 1, status: PROPERTY_STATUS.ACTIVE, removedAt: null, lastSeen: ts() })
      .where(inArray(properties.id, toRescue.map((r) => r.id)));
  }

  // Re-listace: hledá neaktivní záznam stejného portálu, který by mohl být
  // stejným inzerátem nahozeným znovu pod novou URL.
  private async findRelistedProperty(listing: RawListing): Promise<RelistCandidate | null> {
    const cutoff = Date.now() - 120 * 24 * 60 * 60 * 1000;
    const candidates = await db
      .select({
        id: properties.id,
        portalName: properties.portalName,
        title: properties.title,
        address: properties.address,
        rooms: properties.rooms,
        area: properties.area,
      })
      .from(properties)
      .where(and(eq(properties.portalName, listing.portalName), eq(properties.isActive, 0), gt(properties.lastSeen, cutoff)))
      .limit(500);

    for (const candidate of candidates) {
      if (listingMatches(listing, candidate)) return candidate;
    }
    return null;
  }

  // Potvrdí odstraněné inzeráty, které už 7+ dní nejsou na portálu k vidění
  // (status removed + removedAt). Pro leady v aktivní fázi zaloguje varování
  // a zmizelý inzerát spáruje na realizovaný prodej (vlastní historie transakcí).
  private async sweepRemovedListings(): Promise<number> {
    const cutoff = Date.now() - REMOVAL_GRACE_MS;

    const candidates = await db
      .select({
        id: properties.id,
        url: properties.url,
        portalName: properties.portalName,
        title: properties.title,
        price: properties.price,
        area: properties.area,
        rooms: properties.rooms,
        condition: properties.condition,
        buildingType: properties.buildingType,
        address: properties.address,
        lat: properties.lat,
        lng: properties.lng,
        removedAt: properties.removedAt,
      })
      .from(properties)
      .where(and(eq(properties.isActive, 0), eq(properties.status, PROPERTY_STATUS.ACTIVE), lte(properties.lastSeen, cutoff)));

    if (candidates.length === 0) return 0;

    const now = ts();
    await db
      .update(properties)
      .set({ status: PROPERTY_STATUS.REMOVED, removedAt: now })
      .where(inArray(properties.id, candidates.map((c) => c.id)));

    // Párování na realizované prodeje — vlastní historie transakcí pro komparace.
    let paired = 0;
    for (const candidate of candidates) {
      const sale = toRealizedSale({ ...candidate, removedAt: now });
      if (!sale) continue;
      try {
        await db
          .insert(realizedSales)
          .values({ ...sale, createdAt: now });
        paired++;
      } catch (e) {
        // Duplicita (PK = property.id) = inzerát už spárován — ignoruj; jiné chyby
        // (např. chybějící tabulka v prod) zaloguj, ať nepropadnou tiše.
        const msg = e instanceof Error ? e.message : String(e);
        if (!/unique|constraint/i.test(msg)) {
          console.error(`[scraping] Párování prodeje selhalo (${candidate.id}): ${msg}`);
        }
      }
    }

    if (paired > 0) {
      await db.insert(activityLog).values({
        id: generateId(),
        type: "scraping",
        message: `Spárováno ${paired} inzerátů na realizované prodeje (vlastní historie)`,
        createdAt: now,
      });
    }

    const titleById = new Map(candidates.map((c) => [c.id, c.title]));
    const relatedLeads = await db
      .select({ propertyId: leads.propertyId, stage: leads.stage })
      .from(leads)
      .where(inArray(leads.propertyId, candidates.map((c) => c.id)));

    for (const lead of relatedLeads) {
      if (lead.stage === "closed" || lead.stage === "lost") continue;
      await db.insert(activityLog).values({
        id: generateId(),
        type: "scraping",
        message: `Inzerat odstranen - pravdepodobne prodan: ${titleById.get(lead.propertyId)}`,
        propertyId: lead.propertyId,
        createdAt: now,
      });
    }

    return candidates.length;
  }
}
