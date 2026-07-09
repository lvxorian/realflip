import { PortalAdapter } from "./base";
import { RawListing } from "../types";
import * as cheerio from "cheerio";

export class AnnonceAdapter extends PortalAdapter {
  private maxPages: number;

  constructor(maxPages = 5) {
    super("annonce");
    this.maxPages = maxPages;
  }

  async crawlListings(): Promise<RawListing[]> {
    const all: RawListing[] = [];

    for (let page = 1; page <= this.maxPages; page++) {
      const url = page === 1
        ? `${this.config.baseUrl}/byty-na-prodej.html`
        : `${this.config.baseUrl}/byty-na-prodej$18-str${page}.html`;

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

    $("div.box.q.ext-item").each((_i, el) => {
      const $el = $(el);

      const titleEl = $el.find("h2 a");
      const title = this.cleanText(titleEl.text());
      const href = titleEl.attr("href") || "";
      if (!title || !href) return;

      const url = href.startsWith("http") ? href : `https://www.annonce.cz${href}`;

      const priceText = $el.find("strong.mini-sticker span").text().trim();
      const price = parseInt(priceText.replace(/\s/g, "").replace(/Kč.*$/i, "")) || 0;
      if (price === 0) return;

      let rooms: string | null = null;
      let area: number | null = null;
      let floor: number | null = null;
      const locationLinks: string[] = [];

      $el.find("table.attrs tr").each((_j, tr) => {
        const $tr = $(tr);
        const label = $tr.find("th").text().trim().toLowerCase();
        const value = $tr.find("td:first-child").text().trim();

        if (label.includes("dispozice")) {
          rooms = $tr.find("td a").first().text().trim() || null;
        } else if (label.includes("plocha")) {
          area = parseFloat(value) || null;
        } else if (label.includes("podlaží") || label.includes("podlazi")) {
          floor = parseInt(value) || null;
        }
      });

      $el.find("table.attrs td.right a").each((_j, a) => {
        const txt = $(a).text().trim();
        if (txt) locationLinks.push(txt);
      });

      const address = locationLinks.length > 0
        ? locationLinks.slice(0, 2).join(", ")
        : null;

      const descEl = $el.find("p.ad-desc a");
      const description = this.cleanText(descEl.text()) || null;

      const imgEl = $el.find("a.thumbnail img");
      const imgSrc = imgEl.attr("src") || "";

      const images: string[] = [];
      if (imgSrc) images.push(imgSrc);

      try {
        const slideshowRaw = $el.find("div.slideshow-container").attr("data-slideshow");
        if (slideshowRaw) {
          const slideshowData = JSON.parse(slideshowRaw.replace(/&quot;/g, '"'));
          if (slideshowData?.content) {
            slideshowData.content.forEach((img: string) => {
              if (img && !images.includes(img)) images.push(img);
            });
          }
        }
      } catch {
        // slideshow data is optional
      }

      const dateText = $el.find("div.ad-date").text().trim();
      const publishedAt = this.parseDate(dateText);

      listings.push({
        portalName: "annonce",
        url,
        title,
        price,
        pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
        area,
        rooms,
        floor,
        condition: null,
        yearBuilt: null,
        address,
        lat: null,
        lng: null,
        contactPhone: null,
        contactName: null,
        contactEmail: null,
        description,
        imageUrls: images,
        publishedAt,
        updatedAt: new Date(),
      });
    });

    return listings;
  }

  private async enrichListing(listing: RawListing): Promise<RawListing> {
    try {
      const html = await this.fetch(listing.url);
      const $ = cheerio.load(html);

      const fullDesc = this.cleanText($("div.popisdetail").text());
      if (!fullDesc) {
        const metaDesc = $('meta[name="description"]').attr("content") || "";
        if (metaDesc) listing.description = metaDesc;
      }

      const yearBuiltMatch = listing.description?.match(/rok[^\d]*(\d{4})/i);
      if (yearBuiltMatch) listing.yearBuilt = parseInt(yearBuiltMatch[1]);

      const floorMatch = listing.description?.match(
        /(\d+)\.\s*(?:NP|nadzemn[ií]m\s+podlaž[ií]|patro)/i
      );
      if (floorMatch) listing.floor = parseInt(floorMatch[1]);

      try {
        const scriptJson = $('script[type="application/ld+json"]').text();
        if (scriptJson) {
          const data = JSON.parse(scriptJson);
          if (data?.geo) {
            listing.lat = data.geo.latitude;
            listing.lng = data.geo.longitude;
          }
          if (data?.image && Array.isArray(data.image)) {
            data.image.forEach((img: string) => {
              if (img && !listing.imageUrls.includes(img)) listing.imageUrls.push(img);
            });
          }
        }
      } catch {
        // optional
      }

      return listing;
    } catch {
      return listing;
    }
  }

  private parseDate(text: string): Date {
    const match = text.match(/(\d+)\.\s*(\d+)\.\s*(\d{4})/);
    if (match) {
      return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    }
    return new Date();
  }

  extractContact(_html: string): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }
}
