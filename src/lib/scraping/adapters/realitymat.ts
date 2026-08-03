import * as cheerio from "cheerio";
import { PortalAdapter } from "./base";
import { RawListing, SearchFilters } from "../types";
import { parseRealityMatDetail } from "../realitymat-parser";

export class RealityMatAdapter extends PortalAdapter {
  private maxPages = 5;

  constructor() {
    super("realitymat");
  }

  async crawlListings(filters?: SearchFilters): Promise<RawListing[]> {
    const results: RawListing[] = [];

    for (let page = 1; page <= this.maxPages; page++) {
      const url = page === 1
        ? "https://www.realitymat.cz/prodej/byty"
        : `https://www.realitymat.cz/prodej/byty?page=${page}`;
      const html = await this.fetch(url);
      const items = this.parseSearchResults(html);
      if (items.length === 0) break;
      results.push(...items);
    }

    const enriched: RawListing[] = [];
    const concurrency = 3;
    for (let i = 0; i < results.length; i += concurrency) {
      const batch = results.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((l) => this.enrichListing(l).catch(() => l))
      );
      enriched.push(...batchResults);
    }

    return enriched;
  }

  private parseSearchResults(html: string): RawListing[] {
    const $ = cheerio.load(html);
    const listings: RawListing[] = [];

    $("div#w1 div.mb-4[data-key]").each((_, el) => {
      try {
        const linkEl = $(el).find("a.stretched-link");
        const href = linkEl.attr("href") || "";
        if (!href || !href.includes("/detail/")) return;

        const detailUrl = href.startsWith("http") ? href : `https://www.realitymat.cz${href}`;
        const title = this.cleanText(linkEl.text()) || "";

        const priceText = this.cleanText($(el).find("div.lead.font-weight-bold").first().text());
        const price = this.extractPrice(priceText ?? "") ?? 0;
        // Pronájmy (Kč/měsíc) nejsou pro flip relevantní — přeskočit
        if (/\/za\s*měsíc/i.test(priceText ?? "") || (price > 0 && price < 50000)) return;

        const address = this.cleanText($(el).find("div.card-body p").first().text()) || title;

        const imgSrc = $(el).find("img.card-img.img-fluid").attr("src") || undefined;

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

    let name: string | null = null;
    const nameEl = $("a[href^='/realitni-makleri/']").first();
    if (nameEl.length) {
      name = this.cleanText(nameEl.text());
    }
    if (!name) {
      name = this.cleanText($("#seller-modal .media-body p").first().text());
    }

    let phone: string | null = null;
    const modalText = this.cleanText($("#seller-modal").text()) ?? "";
    const phoneMatch = modalText.match(/\+?\d{3}\s*\d{3}\s*\d{3}\s*\d{3}/);
    if (phoneMatch) phone = phoneMatch[0].replace(/\s+/g, "");

    let email: string | null = null;
    const mailMatch = modalText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (mailMatch) email = mailMatch[0];

    return { phone, name, email };
  }

  async enrichListing(raw: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(raw.url);
      return parseRealityMatDetail(html, raw.url);
    } catch {
      return raw;
    }
  }
}
