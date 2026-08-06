import * as cheerio from "cheerio";
import { PortalAdapter } from "./base";
import { RawListing } from "../types";
import { parseRealityMixDetail } from "../realitymix-parser";

export class RealityMixAdapter extends PortalAdapter {
  private maxPages = 5;

  constructor() {
    super("realitymix");
  }

  async crawlListings(): Promise<RawListing[]> {
    const results: RawListing[] = [];

    const basePath = `${this.config.baseUrl}${this.config.searchPath}`;

    for (let page = 1; page <= this.maxPages; page++) {
      const url = page === 1 ? basePath : `${basePath}?stranka=${page}`;
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

    $("li.w-full.advert-item").each((_, el) => {
      try {
        const linkEl = $(el).find(".advert-item__content-carousel-wrapper .swiper-slide a").first();
        const href = linkEl.attr("href") || "";
        if (!href) return;

        const detailUrl = href.startsWith("http") ? href : `${this.config.baseUrl}${href}`;

        let title = this.cleanText($(el).find("h2 a span").first().text()) || "";
        if (!title) {
          const alt = $(el).find(".advert-item__content-carousel-wrapper img").first().attr("alt");
          if (alt) title = this.cleanText(alt) || "";
        }
        if (!title) return;

        const priceContainer = $(el).find("div.text-xl.font-extrabold").first();
        const priceText = this.cleanText(priceContainer.find("span").first().text());
        const price = this.extractPrice(priceText ?? "") ?? 0;
        // Pronájmy (Kč/měsíc) nejsou pro flip relevantní — přeskočit
        if (/za\s*m[ěe]s[ií]c/i.test(priceContainer.text() ?? "") || (price > 0 && price < 50000)) return;

        const substage = this.cleanText($(el).find("p.text-body-light").first().text());

        const imgSrc = $(el).find(".advert-item__content-carousel-wrapper img").first().attr("src") || undefined;

        const area = this.extractArea(title);
        const rooms = this.extractRooms(title);

        const now = Date.now();
        listings.push({
          portalName: "realitymix",
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
          address: substage || title,
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

    const name = this.cleanText($(".offer-detail-sidebar__agent p a").first().text());

    let phone: string | null = null;
    $('a[rel="nofollow"][href^="/trackredir/"]').each((_, el) => {
      const text = this.cleanText($(el).text());
      if (text) {
        phone = text.replace(/[^\d+]/g, "");
        if (phone) return false;
      }
    });

    let email: string | null = null;
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr("href")?.replace("mailto:", "").split("?")[0].trim() || null;
      if (href) {
        email = href;
        return false;
      }
    });

    return { phone: phone || null, name, email };
  }

  async enrichListing(raw: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(raw.url);
      return parseRealityMixDetail(html, raw.url);
    } catch {
      return raw;
    }
  }
}