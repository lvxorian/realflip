import { PortalAdapter } from "./base";
import { RawListing } from "../types";
import * as cheerio from "cheerio";

export class RealityCzAdapter extends PortalAdapter {
  private maxPages: number;

  constructor(maxPages = 5) {
    super("reality-cz");
    this.maxPages = maxPages;
  }

  async crawlListings(): Promise<RawListing[]> {
    const all: RawListing[] = [];
    let pageUrl = "/prodej/byty/Ceska-republika/";

    for (let page = 0; page < this.maxPages; page++) {
      const url = `${this.config.baseUrl}${pageUrl}`;
      const html = await this.fetch(url);
      const $ = cheerio.load(html);

      const listings = this.parsePage($, url);
      all.push(...listings);

      const nextLink = $("#strankovani a[href*='?g=']").first().attr("href");
      if (!nextLink) break;

      pageUrl = nextLink.startsWith("http")
        ? new URL(nextLink).pathname + new URL(nextLink).search
        : `/prodej/byty/hlavni-mesto-Praha/${nextLink}`;
    }

    const enriched = await Promise.all(
      all.map((l) => this.enrichListing(l))
    );

    return enriched;
  }

  private parsePage($: cheerio.CheerioAPI, _pageUrl: string): RawListing[] {
    const listings: RawListing[] = [];

    $("div.xvypis").each((_i, el) => {
      const $el = $(el);
      const $titleLink = $el.find("p.vypisnaz a").first();
      const title = this.cleanText($titleLink.text());
      if (!title) return;

      const href = $titleLink.attr("href") || "";
      const id = $el.attr("id") || "";
      const listingId = id.replace(/^id/, "");

      const priceEl = $el.find("p.vypiscena span:not(.neucena) strong").first();
      const noPrice = $el.find("p.vypiscena span.neucena").length > 0;

      if (noPrice || !priceEl.length) return;

      const priceText = this.cleanText(priceEl.text()) || "";
      const price = this.parsePrice(priceText);
      if (price === 0) return;

      const layoutText = this.cleanText($el.find("p.lokalita").first().text()) || "";
      const rooms = this.extractRooms(layoutText) || this.extractRooms(title);
      const area = this.extractArea(layoutText);

      const img = $el.find("div.thumbnail img").first().attr("src") || "";

      const classList = ($el.attr("class") || "").split(/\s+/);
      let lat: number | null = null;
      let lng: number | null = null;
      for (const cls of classList) {
        const latMatch = cls.match(/^gpsx([\d.]+)$/);
        const lngMatch = cls.match(/^gpsy([\d.]+)$/);
        if (latMatch) lat = parseFloat(latMatch[1]);
        if (lngMatch) lng = parseFloat(lngMatch[1]);
      }
      if (lat !== null && lat === 0) lat = null;
      if (lng !== null && lng === 0) lng = null;

      const url = href.startsWith("http")
        ? href
        : `${this.config.baseUrl}/${listingId}/`;

      listings.push({
        portalName: "reality-cz",
        url,
        title,
        price,
        pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
        area: area && area > 0 ? area : null,
        rooms,
        floor: null,
        condition: this.inferCondition(layoutText),
        buildingType: null,
        yearBuilt: null,
        address: title,
        lat,
        lng,
        contactPhone: null,
        contactName: null,
        contactEmail: null,
        description: null,
        imageUrls: img ? [img.startsWith("http") ? img : `https://www.reality.cz${img}`] : [],
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

      const titleEl = $("h2#znazev").first();
      const detailTitle = this.cleanText(titleEl.text());
      if (detailTitle) listing.title = detailTitle;

      const priceText = this.cleanText($("span.detcena").first().text());
      if (priceText) {
        const parsed = this.parsePrice(priceText);
        if (parsed > 0) listing.price = parsed;
      }

      const fullDesc = this.cleanText($("div#popis div.pr10").text());
      if (fullDesc) {
        listing.description = fullDesc;

        const yearMatch = fullDesc.match(/rok[^\d]*(\d{4})/i);
        if (yearMatch) listing.yearBuilt = parseInt(yearMatch[1]);

        const floorMatch = fullDesc.match(/(\d+)\.\s*(?:NP|nadzemn[ií]m\s+podlaž[ií]|patro)/i);
        if (floorMatch) listing.floor = parseInt(floorMatch[1]);

        const condition = this.inferCondition(fullDesc);
        if (condition) listing.condition = condition;
      }

      if (!listing.buildingType && fullDesc) {
        const bt = fullDesc.match(/cihlov[éý]|panel[ovýáé]|novostavba|sm[íi]šen[ýé]/i);
        if (bt) listing.buildingType = /cihlov/i.test(bt[0]) ? "brick" : /panel/i.test(bt[0]) ? "panel" : /novostavba/i.test(bt[0]) ? "new" : "mixed";
      }

      $("table.detailbytu tr").each((_i, tr) => {
        const $tr = $(tr);
        const label = this.cleanText($tr.find("th").text()) || "";
        const value = this.cleanText($tr.find("td").text()) || "";
        if (!label || !value) return;

        if (/patro/i.test(label) && !listing.floor) {
          const m = value.match(/(\d+)\./);
          if (m) listing.floor = parseInt(m[1]);
        }

        if (/plocha/i.test(label) && !listing.area) {
          const m = value.match(/(\d+[,\d]*)\s*m[²2]/i);
          if (m) {
            const a = parseFloat(m[1].replace(",", "."));
            if (a > 0) listing.area = a;
          }
        }

        if (/(výstavba|rok)/i.test(label)) {
          const ym = value.match(/(\d{4})/);
          if (ym && !listing.yearBuilt) listing.yearBuilt = parseInt(ym[1]);
        }

        if (/velikost/i.test(label)) {
          const r = this.extractRooms(value);
          if (r) listing.rooms = r;
        }

        if (/druh.*budovy/i.test(label)) {
          const c = this.inferCondition(value);
          if (c) listing.condition = c;
        }

        if (/(konstrukce|materi[áa]l)/i.test(label) && !listing.buildingType) {
          listing.buildingType = /cihlov/i.test(value) ? "brick" : /panel/i.test(value) ? "panel" : null;
        }
      });

      const images: string[] = [];
      $("div#galerie a[href^='/photo/']").each((_i, a) => {
        const src = $(a).attr("href");
        if (src) {
          const fullSrc = src.startsWith("http") ? src : `https://www.reality.cz${src}`;
          if (!images.includes(fullSrc)) images.push(fullSrc);
        }
      });

      if (images.length > 0) {
        listing.imageUrls = images;
      } else if (listing.imageUrls.length > 0) {
        const mainPhoto = $("a#mainfoto img").attr("src") || "";
        if (mainPhoto) {
          listing.imageUrls = [
            mainPhoto.startsWith("http") ? mainPhoto : `https://www.reality.cz${mainPhoto}`,
          ];
        }
      }

      const phone = this.cleanText($("#divrkrol span.fs13.bld").text());
      if (phone) listing.contactPhone = phone;

      const dateText = this.cleanText(
        $("div.moreobal div.fss").first().text()
      );
      if (dateText) {
        const dm = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (dm) {
          const d = new Date(parseInt(dm[3]), parseInt(dm[2]) - 1, parseInt(dm[1]));
          if (!isNaN(d.getTime())) listing.publishedAt = d;
        }
      }

      const scriptText = $("script").text();
      const latMatch = scriptText.match(/gpsx:\s*([\d.]+)/);
      const lngMatch = scriptText.match(/gpsy:\s*([\d.]+)/);
      if (latMatch && lngMatch) {
        const parsedLat = parseFloat(latMatch[1]);
        const parsedLng = parseFloat(lngMatch[1]);
        if (parsedLat !== 0) listing.lat = parsedLat;
        if (parsedLng !== 0) listing.lng = parsedLng;
      }

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
