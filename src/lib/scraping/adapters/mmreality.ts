import { PortalAdapter } from "./base";
import { RawListing, PortalName, SearchFilters, filterImages, isValidPrice } from "../types";
import { inferConditionFromText } from "@/lib/analysis/condition";
import * as cheerio from "cheerio";

interface MmrOffer {
  id: number;
  title: string;
  originalTitle: string;
  shortTitle: string;
  location: string;
  slug: string;
  totalArea: number;
  municipality: string;
  municipalityPart: string;
  street: string;
  district: string;
  category: { name: string };
  group: { name: string };
  type: { name: string };
  point: { latitude: number; longitude: number };
  description: string;
  price?: number;
}

export class MmrealityAdapter extends PortalAdapter {
  private maxPages: number;

  constructor(maxPages = 5) {
    super("mmreality");
    this.maxPages = maxPages;
  }

  async crawlListings(filters?: SearchFilters): Promise<RawListing[]> {
    const all: RawListing[] = [];

    for (let page = 1; page <= this.maxPages; page++) {
      const url = page === 1
        ? `${this.config.baseUrl}${this.config.searchPath}`
        : `${this.config.baseUrl}${this.config.searchPath}/?page=${page}`;

      const html = await this.fetch(url);
      const listings = this.parsePage(html);
      all.push(...listings);

      if (listings.length === 0) break;
    }

    const enriched = await Promise.all(
      all.map((l) => this.enrichListing(l))
    );

    return enriched;
  }

  private parsePage(html: string): RawListing[] {
    const $ = cheerio.load(html);
    const listings: RawListing[] = [];

    const ssrRaw = $("vue-property-list-grid").attr(":ssr");
    let offers: MmrOffer[] = [];
    if (ssrRaw) {
      try {
        offers = JSON.parse(ssrRaw.replace(/&quot;/g, '"')).offers;
      } catch {
        // fall back to HTML parsing
      }
    }

    const cards = $("div.rds-property-list-grid > a").toArray();

    cards.forEach((el, i) => {
      const $el = $(el);
      const href = $el.attr("href") || "";
      const cardId = $el.attr("data-card-id") || "";

      const title = this.cleanText($el.find("h4.rds-property-title").text()) || "";
      if (!title) return;

      const priceText = this.cleanText($el.find("div.tw-text-text-price").text()) || "";
      const price = this.parsePrice(priceText);

      if (price === 0) return;

      const imageUrl = $el.find("img.rds-image").first().attr("src") || "";
      const images: string[] = [];
      $el.find("img.rds-image").each((_j, img) => {
        const src = $(img).attr("src");
        if (src) images.push(src);
      });
      const filteredImages = filterImages(images, this.config.name);

      const offer = offers[i];

      // Skip non-apartment listings
      if (offer && offer.group?.name && offer.group.name !== "Byty") return;

      const rooms = this.extractRooms(offer?.type?.name || title);
      const area = offer?.totalArea || this.extractArea(title) || 0;
      const addressParts = [offer?.street, offer?.municipality].filter(Boolean);
      const address = addressParts.length > 0 ? addressParts.join(", ") : title;

      const url = href.startsWith("http") ? href : `https://www.mmreality.cz${href.startsWith("/") ? href : `/nemovitosti/${cardId}/`}`;

      listings.push({
        portalName: "mmreality",
        url,
        title: offer?.originalTitle || title,
        price,
        pricePerSqm: area > 0 ? Math.round(price / area) : null,
        area: area > 0 ? area : null,
        rooms,
        floor: null,
        condition: null,
        buildingType: null,
        yearBuilt: null,
        address,
        lat: offer?.point?.latitude || null,
        lng: offer?.point?.longitude || null,
        contactPhone: null,
        contactName: null,
        contactEmail: null,
        description: offer?.description ? this.cleanText(offer.description) : null,
        imageUrls: filteredImages,
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

      const detailTitle = $("h1.rds-property-detail-title").text().trim();
      if (detailTitle) listing.title = detailTitle;

      const fullDesc = this.cleanText($('div[data-cy="description-content"]').text());
      if (fullDesc) listing.description = fullDesc;

      if (listing.description) {
        listing.condition = inferConditionFromText(listing.description, listing.title);
      }

      if (!listing.buildingType && listing.description) {
        const bt = listing.description.match(/cihlov[éý]|panel[ovýáé]|novostavba|sm[íi]šen[ýé]/i);
        if (bt) listing.buildingType = /cihlov/i.test(bt[0]) ? "brick" : /panel/i.test(bt[0]) ? "panel" : /novostavba/i.test(bt[0]) ? "new" : "mixed";
      }

      const yearBuiltMatch = listing.description?.match(/rok[^\d]*(\d{4})/i);
      if (yearBuiltMatch) listing.yearBuilt = parseInt(yearBuiltMatch[1]);

      const floorMatch = listing.description?.match(/(\d+)\.\s*(?:NP|nadzemn[ií]m\s+podlaž[ií]|patro)/i);
      if (floorMatch) listing.floor = parseInt(floorMatch[1]);

      const images: string[] = [];
      $("img.rds-image").each((_i, el) => {
        const src = $(el).attr("src");
        if (src && !images.includes(src)) images.push(src);
      });
      if (images.length > 0) listing.imageUrls = filterImages(images, this.config.name);

      return listing;
    } catch {
      return listing;
    }
  }

  private parsePrice(text: string): number {
    const cleaned = text.replace(/\s/g, "").replace(/Kč.*$/i, "").trim();
    const num = parseInt(cleaned);
    if (isNaN(num)) return 0;
    return isValidPrice(num) ? num : 0;
  }

  extractContact(_html: string): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }
}
