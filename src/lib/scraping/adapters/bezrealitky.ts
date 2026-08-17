import { PortalAdapter, CrawlStep } from "./base";
import { RawListing, SearchFilters } from "../types";
import { parseBezrealitkyDetail, parseBezrealitkySearch } from "../bezrealitky-parser";
import { matchFilters, isCzechListing } from "../filters";

export class BezrealitkyAdapter extends PortalAdapter {
  private maxPages = 5;

  constructor() {
    super("bezrealitky");
  }

  private buildSearchUrl(page: number): string {
    const base = "https://www.bezrealitky.cz/vyhledat";
    const params = new URLSearchParams({
      country: "ceska-republika",
      currency: "CZK",
      location: "fromMap",
      offerType: "PRODEJ",
      estateType: "BYT",
      order: "TIMEORDER_DESC",
      page: String(page),
    });
    return `${base}?${params.toString()}`;
  }

  async crawlListings(filters?: SearchFilters, ctx?: CrawlStep): Promise<RawListing[]> {
    const results: RawListing[] = [];

    await this.forPages(ctx, this.maxPages, async (page) => {
      const html = await this.fetch(this.buildSearchUrl(page));
      const { listings } = parseBezrealitkySearch(html, this.buildSearchUrl(page));
      results.push(...listings);
      return listings.length;
    });

    // Bezrealitky search URL nepodporuje přímé omezení na lokalitu —
    // filtrujeme zde, aby zůstaly jen inzeráty odpovídající hledání a ČR.
    const filtered = results.filter(
      (l) => matchFilters(l, filters ?? {}) && isCzechListing(l)
    );
    results.length = 0;
    results.push(...filtered);

    // Search Apollo cache už obsahuje plná advert data — detail fetch jen pro
    // listingy s chybějícími kritickými poli (fotky/GPS/popis), aby run
    // netimeoutoval na Vercelu (maxDuration=60).
    const needsDetail = (l: RawListing) =>
      !l.imageUrls?.length || !l.lat || !l.lng || !l.description;
    const toEnrich = results.filter(needsDetail);
    const byUrl = new Map(results.map((l) => [l.url, l]));

    const enriched = await this.enrichBatch(toEnrich, (l) => this.enrichListing(l), 3, ctx);
    enriched.forEach((l) => byUrl.set(l.url, l));

    return results.map((l) => byUrl.get(l.url) ?? l);
  }

  extractContact(_html: string): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }

  async enrichListing(raw: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(raw.url);
      return parseBezrealitkyDetail(html, raw.url);
    } catch {
      return raw;
    }
  }
}
