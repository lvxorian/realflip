import * as cheerio from "cheerio";
import { PortalAdapter } from "./base";
import { RawListing, SearchFilters, filterImages } from "../types";
import { generateId } from "@/lib/utils";

export class IdnesRealityAdapter extends PortalAdapter {
  private maxPages = 5;

  constructor() {
    super("idnes-reality");
  }

  async crawlListings(filters?: SearchFilters): Promise<RawListing[]> {
    const results: RawListing[] = [];
    const searchPath = this.buildSearchPath(filters);

    for (let page = 1; page <= this.maxPages; page++) {
      const url = page === 1 ? searchPath : `${searchPath}?strana=${page}`;
      const html = await this.fetch(url);
      const items = this.parseSearchResults(html, url);
      if (items.length === 0) break;
      results.push(...items);
    }

    const enriched = await Promise.all(
      results.map((l) => this.enrichListing(l).catch(() => l))
    );

    return enriched;
  }

  private buildSearchPath(filters?: SearchFilters): string {
    const city = filters?.location
      ? this.slugifyCity(filters.location)
      : "";

    return `https://reality.idnes.cz/s/prodej/byty/${city}`;
  }

  private slugifyCity(city: string): string {
    const map: Record<string, string> = {
      praha: "praha",
      brno: "brno",
      ostrava: "ostrava",
      plzen: "plzen",
      olomouc: "olomouc",
      "ceske budejovice": "ceske-budejovice",
      "ceské budějovice": "ceske-budejovice",
      "hradec kralove": "hradec-kralove",
      "hradec králové": "hradec-kralove",
      pardubice: "pardubice",
      liberec: "liberec",
      usti: "usti-nad-labem",
      "usti nad labem": "usti-nad-labem",
      "ústí nad labem": "usti-nad-labem",
      zlin: "zlin",
      zlín: "zlin",
    };
    return map[city.toLowerCase().trim()] ?? city.toLowerCase().trim();
  }

  private parseSearchResults(html: string, currentUrl: string): RawListing[] {
    const $ = cheerio.load(html);
    const listings: RawListing[] = [];

    $("div.c-products__item").each((_, el) => {
      try {
        const link = $(el).find("a.c-products__link");
        let detailUrl = link.attr("href") || "";
        if (detailUrl && !detailUrl.startsWith("http")) {
          detailUrl = `https://reality.idnes.cz${detailUrl.startsWith("/") ? "" : "/"}${detailUrl}`;
        }
        if (!detailUrl) return;

        const titleEl = $(el).find("h2.c-products__title");
        const title = this.cleanText(titleEl.text()) || "";

        const priceStr = $(el).find("p.c-products__price strong").text();
        const price = this.parsePrice(priceStr);

        const address = this.cleanText($(el).find("p.c-products__info").text()) || "";

        const imgStyle = $(el).find("span.c-products__img").attr("style") || "";
        const imgMatch = imgStyle.match(/url\('([^']+)'\)/);
        const bgImage = imgMatch ? imgMatch[1].replace(/\\/g, "") : null;

        const imgEl = $(el).find("span.c-products__img img");
        const imageUrl = imgEl.attr("data-src") || imgEl.attr("src") || bgImage || undefined;

        const area = this.extractAreaFromTitle(title);
        const rooms = this.extractRoomsFromTitle(title);

        const now = Date.now();
        listings.push({
          portalName: "idnes-reality",
          url: detailUrl,
          title,
          price: price ?? 0,
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
          imageUrls: imageUrl ? filterImages([imageUrl], this.config.name) : [],
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

    let phone: string | null = null;
    let email: string | null = null;
    let name: string | null = null;

    $('a[href^="tel:"]').each((_, el) => {
      const val = $(el).text().trim();
      if (val && /[\d\s+]{6,}/.test(val)) {
        phone = val.replace(/\s+/g, "");
      }
    });

    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const mail = href.replace("mailto:", "").split("?")[0];
      if (mail && mail.includes("@")) {
        email = decodeURIComponent(mail);
      }
    });

    const nameEl = $("h2.b-author__title a");
    if (nameEl.length) {
      name = this.cleanText(nameEl.text());
    }

    return { phone, name, email };
  }

  async enrichListing(raw: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(raw.url);
      const $ = cheerio.load(html);

      const title = $(`h1.b-detail__title span`).text().trim() || raw.title;
      const address = $(`p.b-detail__info`).text().trim() || raw.address;
      const priceStr = $(`p.b-detail__price strong`).text();
      const price = this.parsePrice(priceStr) ?? raw.price;

      const descEl = $(`div.b-desc`);
      const description = descEl.length ? descEl.text().trim() : null;

      const images: string[] = [];
      $(`a.carousel__item img[data-lazy]`).each((_, el) => {
        const src = $(el).attr("data-lazy");
        if (src) images.push(src);
      });
      if (images.length === 0) {
        $(`a.carousel__item img[src]`).each((_, el) => {
          const src = $(el).attr("src");
          if (src && !src.includes("no-image")) images.push(src);
        });
      }

      const params = this.parseParams($);

      const { phone, name, email } = this.extractContact(html);

      const now = Date.now();
      return {
        ...raw,
        title,
        price,
        pricePerSqm: price && params.area ? Math.round(price / params.area) : null,
        area: params.area ?? raw.area,
        rooms: params.rooms ?? raw.rooms,
        floor: params.floor,
        condition: params.condition,
        buildingType: params.buildingType,
        address,
        description,
        imageUrls: images.length > 0 ? filterImages(images, this.config.name) : raw.imageUrls,
        contactPhone: phone,
        contactName: name,
        contactEmail: email,
        updatedAt: now,
      };
    } catch {
      return raw;
    }
  }

  private parseParams($: cheerio.CheerioAPI): {
    area: number | null;
    rooms: string | null;
    floor: number | null;
    condition: string | null;
    buildingType: string | null;
  } {
    let area: number | null = null;
    let rooms: string | null = null;
    let floor: number | null = null;
    let condition: string | null = null;
    let buildingType: string | null = null;

    const paramMap: Record<string, string> = {};
    const dts = $(`div.b-definition-columns dl dt`);
    dts.each((i, dtEl) => {
      const key = $(dtEl).text().trim().toLowerCase();
      const dd = $(dtEl).next("dd");
      const val = dd.text().trim();
      paramMap[key] = val;
    });

    const areaStr = paramMap["užitná plocha"];
    if (areaStr) {
      const m = areaStr.match(/(\d[\s\d]*)/);
      if (m) area = parseInt(m[1].replace(/\s/g, ""));
    }

    const titleText = $(`h1.b-detail__title span`).text().trim();
    if (titleText) {
      const rm = titleText.match(/(\d+\+kk|\d+\+1|\d\+kk|\d\+1|garsonka|atypick[eé]ho)/i);
      if (rm) {
        rooms = rm[1].toLowerCase();
        if (rooms === "garsonka" || rooms === "atypického") rooms = "1+kk";
      }
    }

    const floorStr = paramMap["podlaží"];
    if (floorStr) {
      const fm = floorStr.match(/(\d+)\./);
      if (fm) floor = parseInt(fm[1]);
    }

    const conditionStr = paramMap["stav bytu"] || paramMap["stav budovy"] || "";
    if (conditionStr) {
      if (/velmi dobr[ýy]/.test(conditionStr) || /dobr[ýy]/.test(conditionStr)) condition = "good";
      else if (/novos?tavba|nov[ýy]/.test(conditionStr)) condition = "new";
      else if (/rekonstru/.test(conditionStr)) condition = "renovated";
      else if (/původn[íi]/.test(conditionStr)) condition = "original";
      else if (/špatn[ýy]|zchátral/.test(conditionStr) || /k demolici/.test(conditionStr)) condition = "dilapidated";
    }

    const buildStr = paramMap["konstrukce budovy"] || "";
    if (buildStr) {
      if (/panel/.test(buildStr)) buildingType = "panel";
      else if (/cihl/.test(buildStr)) buildingType = "brick";
      else if (/smíšen/.test(buildStr)) buildingType = "mixed";
      else if (/novos?tavba/.test(buildStr)) buildingType = "new";
    }

    return { area, rooms, floor, condition, buildingType };
  }

  private parsePrice(str: string): number | null {
    if (!str) return null;
    const cleaned = str.replace(/&zwnj;/g, "").replace(/\s/g, "").replace(/Kč/g, "").trim();
    const n = parseInt(cleaned);
    return isNaN(n) ? null : n;
  }

  private extractAreaFromTitle(title: string | null): number | null {
    if (!title) return null;
    const m = title.match(/(\d+)\s*m/i);
    return m ? parseInt(m[1]) : null;
  }

  private extractRoomsFromTitle(title: string | null): string | null {
    if (!title) return null;
    const m = title.match(/(\d+\+kk|\d+\+1|\d\+kk|\d\+1)/i);
    if (m) return m[1].toLowerCase();
    if (/garsonka|atypick/i.test(title)) return "1+kk";
    return null;
  }
}
