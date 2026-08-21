import * as cheerio from "cheerio";
import { PortalAdapter, CrawlStep } from "./base";
import { RawListing, SearchFilters } from "../types";
import { parseRealityMatDetail, parseRealityMatContact } from "../realitymat-parser";

export class RealityMatAdapter extends PortalAdapter {
  private maxPages = 5;

  constructor() {
    super("realitymat");
  }

  async crawlListings(filters?: SearchFilters, ctx?: CrawlStep): Promise<RawListing[]> {
    const results: RawListing[] = [];

    const citySlug = filters?.location ? this.slugFor(filters.location) : null;
    const basePath = citySlug
      ? `https://www.realitymat.cz/prodej/byty/${citySlug}`
      : "https://www.realitymat.cz/prodej/byty";

    await this.forPages(ctx, this.maxPages, async (page) => {
      const url = page === 1
        ? basePath
        : `${basePath}?page=${page}`;
      const html = await this.fetch(url);
      const items = this.parseSearchResults(html);
      results.push(...items);
      return items.length;
    });

    return this.enrichBatch(results, (l) => this.enrichListing(l), 3, ctx);
  }

  private parseSearchResults(html: string): RawListing[] {
    const $ = cheerio.load(html);
    const listings: RawListing[] = [];

    // data-key je na sloupcovém wrapperu (div.col-*), karta je vnitřní div.card —
    // starý selektor (div#w1 div.mb-4[data-key]) po redesignu stránky nenašel nic.
    $("div#w1 div[data-key]").each((_, el) => {
      try {
        const linkEl = $(el).find("a.stretched-link");
        const href = linkEl.attr("href") || "";
        if (!href || !href.includes("/detail/")) return;

        const detailUrl = href.startsWith("http") ? href : `https://www.realitymat.cz${href}`;
        const title = this.cleanText(linkEl.text()) || "";

        const priceText = this.cleanText($(el).find("p.font-weight-bold").first().text());
        const price = this.extractPrice(priceText ?? "") ?? 0;
        // Pronájmy (Kč/měsíc) nejsou pro flip relevantní — přeskočit
        if (/\/za\s*měsíc/i.test(priceText ?? "") || (price > 0 && price < 50000)) return;

        // Nová karta nemá samostatný adresní řádek — adresa je v titulku.
        const address = title;

        // Lazy img: data-src má plný obrázek, src je jen preload placeholder.
        const imgEl = $(el).find("img.img-fluid").first();
        const imgSrc = imgEl.attr("data-src") || imgEl.attr("src") || undefined;

        const area = this.extractArea(title);
        const rooms = this.extractRooms(title);

        const now = Date.now();
        listings.push({
          portalName: "realitymat",
          url: detailUrl,
          title,
          price,
          pricePerSqm: price && area ? Math.round(price / area) : null,
          area,
          rooms,
          floor: null,
          condition: null,
          buildingType: null,
          yearBuilt: null,
          address: address || null,
          lat: null,
          lng: null,
          contactPhone: null,
          contactName: null,
          contactEmail: null,
          description: null,
          imageUrls: imgSrc ? [imgSrc] : [],
          publishedAt: now,
          updatedAt: now,
        });
      } catch {
        // skip malformed items
      }
    });

    return listings;
  }

  extractContact(html: string): { phone: string | null; name: string | null; email: string | null } {
    const $ = cheerio.load(html);
    return parseRealityMatContact($);
  }

  async enrichListing(raw: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(raw.url);
      return parseRealityMatDetail(html, raw.url);
    } catch {
      return raw;
    }
  }

  /** Vrátí slug města pro URL realitymat.cz (např. "karlovy-vary"). */
  private slugFor(city: string): string {
    return city
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/[áä]/g, "a")
      .replace(/[čć]/g, "c")
      .replace(/[ď]/g, "d")
      .replace(/[éěè]/g, "e")
      .replace(/[íì]/g, "i")
      .replace(/[ň]/g, "n")
      .replace(/[óö]/g, "o")
      .replace(/[ř]/g, "r")
      .replace(/[š]/g, "s")
      .replace(/[ť]/g, "t")
      .replace(/[úůü]/g, "u")
      .replace(/[ý]/g, "y")
      .replace(/[ž]/g, "z");
  }

  async crawlCityListings(cityKey: string, limit = 40, ctx?: CrawlStep): Promise<RawListing[]> {
    const slug = this.slugFor(cityKey.replace(/_/g, "-"));
    const results: RawListing[] = [];

    await this.forPages(ctx, this.maxPages, async (page) => {
      const url = page === 1
        ? `https://www.realitymat.cz/prodej/byty/${slug}`
        : `https://www.realitymat.cz/prodej/byty/${slug}?page=${page}`;
      const html = await this.fetch(url);
      const items = this.parseSearchResults(html);
      results.push(...items);
      if (results.length >= limit) return 0;
      return items.length;
    });

    return this.enrichBatch(results, (l) => this.enrichListing(l), 3, ctx);
  }
}
