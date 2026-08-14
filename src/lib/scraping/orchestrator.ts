import { PortalAdapter } from "./adapters/base";
import { PortalName, PORTAL_CONFIGS, RawListing, SearchFilters, isValidPrice, filterImages } from "./types";
import { matchFilters, isCzechListing, isSaleListing } from "./filters";
import { applyAreaResolution } from "./area-resolver";
import { Deduplicator } from "./deduplicator";
import { db } from "@/db";
import { properties, propertyAnalysis, scrapingJobs, activityLog, priceHistory, searches, searchProperties, leads, realizedSales } from "@/db/schema";
import { toRealizedSale } from "./sold-pairing";
import { eq, and, ne, notInArray, inArray, lte, gt } from "drizzle-orm";
import { listingMatches, PROPERTY_STATUS, REMOVAL_GRACE_MS, type RelistCandidate } from "./relisting";
import { matchStrengthCrossPortal, isAutoMergeMatch, parseAltPortals, appendAltPortal, hasAltUrl, toDbAltPortals } from "./property-match";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { analyzeListing as aiAnalyzeListing } from "@/lib/ai/analyzer";
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

  async crawlSearch(
    searchId: string,
    filters: SearchFilters
  ): Promise<{ total: number; errors: string[] }> {
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
            if (propertyId) total++;
          } catch (err) {
            errors.push(`Failed to save listing ${listing.url}: ${err}`);
          }
        }
      } catch (err) {
        errors.push(`Crawl error (${portal}): ${err}`);
      }

      allErrors.push(...errors);
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

  async crawlAllForUser(userId: string): Promise<{ total: number; runCount: number; failed: string[] }> {
    const userSearches = await db
      .select()
      .from(searches)
      .where(eq(searches.userId, userId));

    let total = 0;
    let runCount = 0;
    const failed: string[] = [];

    for (const search of userSearches) {
      let filters: SearchFilters = {};
      try {
        filters = JSON.parse(search.filters) as SearchFilters;
      } catch {
        failed.push(`Search ${search.id} (${search.name}): invalid filters`);
        continue;
      }

      try {
        const result = await this.crawlSearch(search.id, filters);
        total += result.total;
        runCount++;
      } catch (err) {
        failed.push(`Search ${search.id} (${search.name}) failed: ${err}`);
      }
    }

    refreshAllMarketData().catch(() => {});
    await this.sweepRemovedListings().catch(() => {});

    return { total, runCount, failed };
  }

  private async saveListing(listing: RawListing, searchId?: string): Promise<string | null> {
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

        // AI re-analysis on price change
        if (process.env.GEMINI_API_KEY) {
          try {
            const { analyzeListing: aiAnalyzeListing } = await import("@/lib/ai/analyzer");
            const aiResult = await aiAnalyzeListing({
              title: listing.title,
              description: listing.description ?? "",
              price: listing.price,
              pricePerSqm: listing.pricePerSqm,
              area: listing.area,
              rooms: listing.rooms,
              address: listing.address,
              condition: listing.condition,
            });
            await db
              .update(propertyAnalysis)
              .set({ aiReport: JSON.stringify(aiResult), updatedAt: ts() })
              .where(eq(propertyAnalysis.propertyId, existing.id));
          } catch {
            // AI analysis is optional
          }
        }

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
      });

      // Initial price record
      await db.insert(priceHistory).values({
        id: generateId(),
        propertyId: id,
        price: listing.price,
        recordedAt: listing.publishedAt ? new Date(listing.publishedAt).getTime() : ts(),
      });

      // Enhanced analysis with live market data
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
          }).catch(() => ({ dynamicRange: null, arvRange: null }))
        : { dynamicRange: null, arvRange: null };
      const analysis = analyzeListing(listing, ranges.dynamicRange, undefined, location, ranges.arvRange);

      // AI analysis (only if API key available)
      let aiReport: string | null = null;
      if (process.env.GEMINI_API_KEY) {
        try {
          const aiResult = await aiAnalyzeListing({
            title: listing.title,
          description: listing.description ?? "",
          price: listing.price,
          pricePerSqm: listing.pricePerSqm,
          area: listing.area,
          rooms: listing.rooms,
          address: listing.address,
          condition: listing.condition,
        });
          aiReport = JSON.stringify(aiResult);
        } catch {
          // AI analysis is optional
        }
      }

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
        aiReport,
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
    const rows = await db
      .select()
      .from(properties)
      .where(gt(properties.lastSeen, cutoff))
      .limit(2000);

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
