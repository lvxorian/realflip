import { PortalAdapter } from "./adapters/base";
import { PortalName, PORTAL_CONFIGS, RawListing, SearchFilters } from "./types";
import { Deduplicator } from "./deduplicator";
import { db } from "@/db";
import { properties, propertyAnalysis, scrapingJobs, activityLog, priceHistory, notifications, searches, searchProperties } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { analyzeListing } from "@/lib/analysis/analyzer";
import { analyzeListing as aiAnalyzeListing } from "@/lib/ai/analyzer";
import { generateId } from "@/lib/utils";

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

    for (const portal of portals) {
      const adapter = this.adapters.get(portal);
      if (!adapter) continue;
      if (!PORTAL_CONFIGS[portal].enabled) continue;

      const errors: string[] = [];
      let found = 0;

      const jobId = generateId();
      await db.insert(scrapingJobs).values({
        id: jobId,
        portal,
        status: "running",
        startedAt: new Date(),
        createdAt: new Date(),
      });

      try {
        const listings = await adapter.crawlListings();
        found = listings.length;

        for (const listing of listings) {
          if (this.deduplicator.isDuplicate(listing.url, listing.title)) continue;

          try {
            await this.saveListing(listing);
            total++;
          } catch (err) {
            errors.push(`Failed to save listing ${listing.url}: ${err}`);
          }
        }
      } catch (err) {
        errors.push(`Crawl error: ${err}`);
      }

      await db
        .update(scrapingJobs)
        .set({
          status: errors.length > 0 && found === 0 ? "failed" : "completed",
          finishedAt: new Date(),
          listingsFound: found,
          errors: JSON.stringify(errors),
        })
        .where(eq(scrapingJobs.id, jobId));

      allErrors.push(...errors);
      if (this.onProgress) this.onProgress(portal, found, errors);

      await db.insert(activityLog).values({
        id: generateId(),
        type: "scraping",
        message: `Scraping ${portal} dokončen (${found} inzerátů)`,
        data: JSON.stringify({ portal, found, errors: errors.length }),
        createdAt: new Date(),
      });
    }

    return { total, errors: allErrors };
  }

  async crawlSearch(
    searchId: string,
    filters: SearchFilters
  ): Promise<{ total: number; errors: string[] }> {
    const portals = Object.keys(PORTAL_CONFIGS) as PortalName[];
    let total = 0;
    const allErrors: string[] = [];

    for (const portal of portals) {
      const adapter = this.adapters.get(portal);
      if (!adapter) continue;
      if (!PORTAL_CONFIGS[portal].enabled) continue;

      const errors: string[] = [];
      let found = 0;

      try {
        let listings = await adapter.crawlListings(filters);
        found = listings.length;

        listings = listings.filter((l) => matchFilters(l, filters));

        for (const listing of listings) {
          if (this.deduplicator.isDuplicate(listing.url, listing.title)) continue;

          try {
            const propertyId = await this.saveListing(listing, searchId);
            if (propertyId) total++;
          } catch (err) {
            errors.push(`Failed to save listing ${listing.url}: ${err}`);
          }
        }
      } catch (err) {
        errors.push(`Crawl error: ${err}`);
      }

      allErrors.push(...errors);
    }

    if (total > 0 || allErrors.length > 0) {
      await db
        .update(searches)
        .set({ lastRunAt: new Date() })
        .where(eq(searches.id, searchId));
    }

    return { total, errors: allErrors };
  }

  async crawlAllScheduled(): Promise<void> {
    const scheduled = await db
      .select()
      .from(searches)
      .where(ne(searches.schedule, "manual"))

    for (const search of scheduled) {
      let filters: SearchFilters = {};
      try {
        filters = JSON.parse(search.filters) as SearchFilters;
      } catch {
        continue;
      }

      await this.crawlSearch(search.id, filters);
    }
  }

  private async saveListing(listing: RawListing, searchId?: string): Promise<string | null> {
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
          recordedAt: new Date(),
        });

        // Log price drop activity
        if (listing.price < existing.price) {
          const dropPct = ((existing.price - listing.price) / existing.price) * 100;
          await db.insert(activityLog).values({
            id: generateId(),
            type: "price",
            message: `Snížení ceny o ${dropPct.toFixed(1)}% – ${listing.title}`,
            propertyId: existing.id,
            createdAt: new Date(),
          });
        }
      }

      await db
        .update(properties)
        .set({
          price: listing.price,
          pricePerSqm: listing.pricePerSqm,
          lastSeen: new Date(),
          isActive: true,
        })
        .where(eq(properties.id, existing.id));

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
          firstSeen: new Date(),
          lastSeen: new Date(),
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
        imageUrls: JSON.stringify(listing.imageUrls),
        status: "active",
        firstSeen: listing.publishedAt || new Date(),
        lastSeen: new Date(),
        isActive: true,
      });

      // Initial price record
      await db.insert(priceHistory).values({
        id: generateId(),
        propertyId: id,
        price: listing.price,
        recordedAt: listing.publishedAt || new Date(),
      });

      // Enhanced analysis
      const analysis = analyzeListing(listing);

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
        recommendation: analysis.recommendation,
        // Nová rozšířená pole
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
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create notification for highly undervalued properties
      if (analysis.undervaluationPct > 10) {
        try {
          await db.insert(notifications).values({
            id: generateId(),
            userId: "system",
            title: "Podhodnocená nemovitost",
            message: `${listing.title} je podhodnocena o ${Math.round(analysis.undervaluationPct)} % (${listing.price.toLocaleString()} Kč)`,
            type: "undervalued",
            data: JSON.stringify({
              propertyId: id,
              undervaluationPct: Math.round(analysis.undervaluationPct),
              price: listing.price,
            }),
            createdAt: new Date(),
          });
        } catch {
          // notifications table has FK to users — skip if user doesn't exist
        }
      }

      await db.insert(activityLog).values({
        id: generateId(),
        type: "new_property",
        message: `Nalezen nový inzerát – ${listing.title}`,
        propertyId: id,
        createdAt: new Date(),
      });

      if (searchId) {
        await db.insert(searchProperties).values({
          searchId,
          propertyId: id,
          firstSeen: new Date(),
          lastSeen: new Date(),
        });
      }

      return id;
    }
  }
}

function matchFilters(listing: RawListing, filters: SearchFilters): boolean {
  if (filters.location) {
    const loc = filters.location.toLowerCase().trim();
    const parts = [listing.address, listing.title].filter(Boolean).join(" ").toLowerCase();
    if (parts && loc && !parts.includes(loc)) return false;
  }
  if (filters.priceMin != null && listing.price < filters.priceMin) return false;
  if (filters.priceMax != null && listing.price > filters.priceMax) return false;
  if (filters.areaMin != null && (listing.area ?? 0) < filters.areaMin) return false;
  if (filters.areaMax != null && (listing.area ?? 0) > filters.areaMax) return false;
  return true;
}
