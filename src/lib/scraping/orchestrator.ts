import { PortalAdapter } from "./adapters/base";
import { PortalName, PORTAL_CONFIGS, RawListing, SearchFilters, isValidPrice, filterImages } from "./types";
import { matchFilters, isCzechListing, isSaleListing } from "./filters";
import { applyAreaResolution } from "./area-resolver";
import { Deduplicator } from "./deduplicator";
import { db } from "@/db";
import { properties, propertyAnalysis, scrapingJobs, activityLog, priceHistory, searches, searchProperties } from "@/db/schema";
import { eq, and, ne, notInArray, inArray } from "drizzle-orm";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { analyzeListing as aiAnalyzeListing } from "@/lib/ai/analyzer";
import { calculateFlipResults } from "@/lib/analysis/flip-costs";
import { generateId, ts, safeJsonParse } from "@/lib/utils";
import { checkPriceDropAlert, checkScoreThresholdAlert } from "@/lib/alert-matcher";
import { classifyLocation, findCityKey } from "@/lib/analysis/location";
import { getPropertyMarketRange, refreshAllMarketData } from "@/lib/scraping/market-price-service";

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
          .select({ id: properties.id, url: properties.url })
          .from(searchProperties)
          .innerJoin(properties, eq(searchProperties.propertyId, properties.id))
          .where(eq(searchProperties.searchId, searchId));

        const staleIds = linked
          .filter((l) => !allFoundUrls.has(l.url))
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
      const dynamicRange = location.city !== "Neznámá"
        ? await getPropertyMarketRange({
            cityKey: location.city,
            lat: listing.lat,
            lng: listing.lng,
            condition: listing.condition,
            buildingType: listing.buildingType,
            area: listing.area,
            category: location.category,
          }).catch(() => null)
        : null;
      const analysis = analyzeListing(listing, dynamicRange, undefined, location);

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
}
