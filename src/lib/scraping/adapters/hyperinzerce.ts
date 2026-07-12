import { PortalAdapter } from "./base";
import { RawListing } from "../types";
import * as cheerio from "cheerio";

export class HyperinzerceAdapter extends PortalAdapter {
  private maxPages: number;

  constructor(maxPages = 5) {
    super("hyperinzerce");
    this.maxPages = maxPages;
  }

  async crawlListings(): Promise<RawListing[]> {
    const all: RawListing[] = [];

    for (let page = 1; page <= this.maxPages; page++) {
      const url = page === 1
        ? `${this.config.baseUrl}${this.config.searchPath}`
        : `${this.config.baseUrl}/byty-prodej?page=${page}`;

      const html = await this.fetch(url);
      const listings = this.parsePage(html);
      if (listings.length === 0) break;
      all.push(...listings);
    }

    const enriched = await Promise.all(
      all.map((l) => this.enrichListing(l))
    );

    return enriched;
  }

  private parsePage(html: string): RawListing[] {
    const $ = cheerio.load(html);
    const listings: RawListing[] = [];

    $("div.c-ad-list__item.js-ad-list-link").each((_i, el) => {
      const $el = $(el);

      const titleEl = $el.find("a.c-ad-list__item-name");
      const title = this.cleanText(titleEl.text());
      if (!title) return;

      const href = $el.attr("data-link") || titleEl.attr("href") || "";
      if (!href) return;
      const url = href.startsWith("http") ? href : `https://byty.hyperinzerce.cz${href}`;

      const priceText = this.cleanText($el.find(".c-ad-list__item-price span").text()) || "";
      const price = this.parsePrice(priceText);
      if (price === 0) return;

      const location = this.cleanText($el.find("span.c-ad-list__item-location").text()) || null;

      const descPreview = this.cleanText($el.find("div.c-ad-list__item-description").text()) || null;

      const imgSrc = $el.find("img.c-ad-list__item-image").attr("src") || "";

      const searchText = title + " " + (descPreview || "");
      const rooms = this.extractRooms(title) || this.extractRooms(searchText) || null;
      const area = this.extractArea(searchText);

      listings.push({
        portalName: "hyperinzerce",
        url,
        title,
        price,
        pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
        area: area && area > 0 ? area : null,
        rooms,
        floor: null,
        condition: this.inferCondition(searchText),
        buildingType: null,
        yearBuilt: null,
        address: location,
        lat: null,
        lng: null,
        contactPhone: null,
        contactName: null,
        contactEmail: null,
        description: descPreview,
        imageUrls: imgSrc ? [imgSrc.startsWith("http") ? imgSrc : `https:${imgSrc}`] : [],
        publishedAt: new Date(),
        updatedAt: new Date(),
      });
    });

    return listings;
  }

  private async enrichListing(listing: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(listing.url);
      const $ = cheerio.load(html);

      const detailTitle = this.cleanText($("h1.c-ad-detail__header-title").text());
      if (detailTitle) listing.title = detailTitle;

      const priceText = this.cleanText($(".c-ad-detail__info-price span").first().text());
      if (priceText) {
        const parsed = this.parsePrice(priceText);
        if (parsed > 0) listing.price = parsed;
      }

      const fullDesc = this.cleanText(
        $("div.c-ad-detail__description-text").html()?.replace(/<br\s*\/?>/gi, "\n") || ""
      );
      if (fullDesc) {
        listing.description = fullDesc;

        const yearMatch = fullDesc.match(/rok[^\d]*(\d{4})/i);
        if (yearMatch) listing.yearBuilt = parseInt(yearMatch[1]);

        const floorMatch = fullDesc.match(/(\d+)\.\s*(?:NP|nadzemn[ií]m\s+podlaž[ií]|patro)/i);
        if (floorMatch) listing.floor = parseInt(floorMatch[1]);

        const condition = this.inferCondition(fullDesc);
        if (condition) listing.condition = condition;
      }

      $(".c-ad-detail__parameters-container > .c-ad-detail__parameters-item").each((_i, el) => {
        const $el = $(el);
        const label = this.cleanText($el.find(".c-ad-detail__parameters-item-label").text()) || "";
        const value = this.cleanText($el.find(".c-ad-detail__parameters-item-content").text()) || "";
        if (!label || !value) return;

        if (/dispozice/i.test(label)) {
          const r = this.extractRooms(value);
          if (r) listing.rooms = r;
        }

        if (/plocha/i.test(label)) {
          const m = value.match(/(\d+[,\d]*)\s*m[²2]/i);
          if (m) {
            const a = parseFloat(m[1].replace(",", "."));
            if (a > 0) listing.area = a;
          }
        }

        if (/patro/i.test(label) && !listing.floor) {
          const m = value.match(/(\d+)\./);
          if (m) listing.floor = parseInt(m[1]);
        }

        if (/(výstavba|rok)/i.test(label)) {
          const ym = value.match(/(\d{4})/);
          if (ym && !listing.yearBuilt) listing.yearBuilt = parseInt(ym[1]);
        }

        if (/stav/i.test(label)) {
          const c = this.inferCondition(value);
          if (c) listing.condition = c;
        }

        if (/(konstrukce|materi[áa]l)/i.test(label) && !listing.buildingType) {
          listing.buildingType = /cihlov/i.test(value) ? "brick" : /panel/i.test(value) ? "panel" : null;
        }
      });

      if (!listing.buildingType && fullDesc) {
        const bt = fullDesc.match(/cihlov[éý]|panel[ovýáé]|novostavba|sm[íi]šen[ýé]/i);
        if (bt) listing.buildingType = /cihlov/i.test(bt[0]) ? "brick" : /panel/i.test(bt[0]) ? "panel" : /novostavba/i.test(bt[0]) ? "new" : "mixed";
      }

      const locationText = this.cleanText($(".c-ad-detail__header-info-location").text());
      if (locationText) listing.address = locationText;

      const images: string[] = [];
      $(".c-gallery-list__item img.js-gallery-item").each((_i, img) => {
        const fullUrl = $(img).attr("data-gallery-full-url");
        if (fullUrl) {
          const absUrl = fullUrl.startsWith("http") ? fullUrl : `https://byty.hyperinzerce.cz${fullUrl}`;
          if (!images.includes(absUrl)) images.push(absUrl);
        }
      });
      if (images.length > 0) listing.imageUrls = images;

      const dateText = this.cleanText($(".c-ad-detail__header-info-date span").text());
      if (dateText) {
        const dm = dateText.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
        if (dm) {
          const d = new Date(parseInt(dm[3]), parseInt(dm[2]) - 1, parseInt(dm[1]));
          if (!isNaN(d.getTime())) listing.publishedAt = d;
        }
      }

      const sellerName = this.cleanText($("a.c-ad-detail__info-seller-name").text());
      if (sellerName) listing.contactName = sellerName;

      return listing;
    } catch {
      return listing;
    }
  }

  private parsePrice(text: string): number {
    const cleaned = text.replace(/\s/g, "").replace(/Kč.*$/i, "").trim();
    const num = parseInt(cleaned);
    return isNaN(num) ? 0 : num;
  }

  private inferCondition(text: string): string | null {
    const t = text.toLowerCase();
    if (/novostavba|nov[ýe]/.test(t) && !/(po|k)\s*rekonstrukci/.test(t)) return "new";
    if (/po\s*rekonstrukci|zrekonstruovan[ýy]/.test(t)) return "renovated";
    if (/velmi\s*dobr[ýy]\s*stav|udržovan[ýy]/.test(t)) return "good";
    if (/k\s*rekonstrukci|původn[íi]|špatn[ýy]\s*stav/.test(t)) return "project";
    if (/dobr[ýy]\s*stav/.test(t)) return "good";
    return null;
  }

  extractContact(_html: string): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }
}
