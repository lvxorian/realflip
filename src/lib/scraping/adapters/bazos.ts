import { PortalAdapter } from "./base";
import { RawListing, PortalName, SearchFilters, filterImages, isValidPrice } from "../types";
import { inferConditionFromText } from "@/lib/analysis/condition";
import * as cheerio from "cheerio";

export class BazosAdapter extends PortalAdapter {
  private searchPath: string;

  constructor(searchPath = "/prodam/byt/") {
    super("bazos");
    this.searchPath = searchPath;
  }

  private getSearchUrl(): string {
    return `${this.config.baseUrl}${this.searchPath}`;
  }

  async crawlListings(filters?: SearchFilters): Promise<RawListing[]> {
    const all: RawListing[] = [];

    for (let page = 1; page <= 5; page++) {
      const pageUrl = page === 1 ? this.getSearchUrl() : `${this.getSearchUrl()}strana/${page}/`;
      const html = await this.fetch(pageUrl);
      const $ = cheerio.load(html);

      let pageCount = 0;
      $("div.inzeraty.inzeratyflex").each((_i, el) => {
        pageCount++;
        const $el = $(el);
        const linkEl = $el.find("h2.nadpis a");
        const link = linkEl.attr("href") || "";
        const title = linkEl.text().trim();
        if (!link || !title) return;

        const fullUrl = link.startsWith("http")
          ? link
          : `${this.config.baseUrl}${link}`;

        const imgThumb = $el.find("img.obrazek").attr("src") || "";

        const priceText = $el.find("div.inzeratycena b").text().trim();
        const price = this.parsePrice(priceText);

        const locText = $el.find("div.inzeratylok").text().trim();
        const address = locText.replace(/\s*(\d{3}\s?\d{2})/, (_, ps) => `, ${ps.trim()}`);

        const descShort = this.cleanText($el.find("div.popis").text()) || "";

        const dateText = $el.find("span.velikost10").text();

        all.push({
          portalName: "bazos",
          url: fullUrl,
          title,
          price,
          pricePerSqm: null,
          area: this.extractArea(title),
          rooms: this.extractRooms(title),
          floor: null,
          condition: null,
          buildingType: null,
          yearBuilt: null,
          address,
          lat: null,
          lng: null,
          contactPhone: null,
          contactName: null,
          contactEmail: null,
          description: descShort,
          imageUrls: imgThumb ? filterImages([imgThumb], this.config.name) : [],
          publishedAt: this.parseDate(dateText),
          updatedAt: Date.now(),
        });
      });

      if (pageCount === 0) break;
    }

    // Enrich with detail page info (GPS, full description, name, more images)
    const enriched = await Promise.all(
      all.map((l) => this.enrichListing(l))
    );

    return enriched;
  }

  private async enrichListing(listing: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(listing.url);
      const $ = cheerio.load(html);

      const detailTitle = $("H1.nadpisdetail").text().trim();
      if (detailTitle) listing.title = detailTitle;

      const fullDesc = this.cleanText($("div.popisdetail").text());
      if (fullDesc) listing.description = fullDesc;
      else {
        const metaDesc = $('meta[name="description"]').attr("content") || "";
        if (metaDesc) listing.description = metaDesc;
      }

      if (listing.description) {
        listing.condition = inferConditionFromText(listing.description, listing.title);
      }

      const nameText = $("td:contains('Jméno')")
        .nextAll("td")
        .first()
        .find("b span")
        .text()
        .trim();
      if (nameText) listing.contactName = nameText;

      const gpsMatch = html.match(
        /google\.com\/maps\/place\/([\d.]+),([\d.]+)/
      );
      if (gpsMatch) {
        listing.lat = parseFloat(gpsMatch[1]);
        listing.lng = parseFloat(gpsMatch[2]);
      }

      const images: string[] = [];
      $("img.carousel-cell-image").each((_i, el) => {
        const src = $(el).attr("data-flickity-lazyload") || $(el).attr("src");
        if (src && !images.includes(src)) images.push(src);
      });
      if (images.length > 0) listing.imageUrls = filterImages(images, this.config.name);

      if (!listing.buildingType && listing.description) {
        const bt = listing.description.match(/cihlov[éý]|panel[ovýáé]|novostavba|sm[íi]šen[ýé]/i);
        if (bt) listing.buildingType = /cihlov/i.test(bt[0]) ? "brick" : /panel/i.test(bt[0]) ? "panel" : /novostavba/i.test(bt[0]) ? "new" : "mixed";
      }

      const yearBuiltMatch = listing.description?.match(
        /rok[^\d]*(\d{4})/i
      );
      if (yearBuiltMatch) {
        listing.yearBuilt = parseInt(yearBuiltMatch[1]);
      }

      const floorMatch = listing.description?.match(
        /(\d+)\.\s*(?:NP|nadzemn[ií]m\s+podlaž[ií]|patro)/i
      );
      if (floorMatch) {
        listing.floor = parseInt(floorMatch[1]);
      }

      if (
        listing.address &&
        !/\d{3}\s?\d{2}/.test(listing.address)
      ) {
        const loc = $("td:contains('Lokalita')")
          .nextAll("td")
          .first()
          .find("a")
          .first()
          .text()
          .trim();
        if (loc) listing.address = loc;
      }

      const phone = this.cleanText($("a[href^='tel:']").first().text());
      if (phone) listing.contactPhone = phone;

      const email = $('a[href^="mailto:"]').attr("href")?.replace("mailto:", "").trim() || "";
      if (email) listing.contactEmail = email;

      return listing;
    } catch {
      return listing;
    }
  }

  private parsePrice(text: string): number {
    const cleaned = text.replace(/\s/g, "").replace(/Kč.*$/, "").trim();
    const num = parseInt(cleaned);
    if (isNaN(num)) return 0;
    return isValidPrice(num) ? num : 0;
  }

  private parseDate(text: string): number {
    const match = text.match(/\[(\d+)\.\s*(\d+)\.\s*(\d{4})\]/);
    if (match) {
      return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1])).getTime();
    }
    return Date.now();
  }

  extractContact(
    _html: string
  ): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }
}
