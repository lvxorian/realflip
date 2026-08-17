import { PortalAdapter } from "./base";
import { RawListing, SearchFilters, filterImages, isValidPrice } from "../types";
import * as cheerio from "cheerio";

const BASE = "https://www.remax-czech.cz";

interface RemaxCard {
  title: string;
  url: string;
  price: number;
  area: number | null;
  rooms: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
}

/**
 * Vytáhne plné verze fotek galerie z detailní stránky remax.cz.
 * Hlavní fotka (#mainImage) i galerie (a[data-fancybox="images"]) mají plnou
 * verzi v `href` — thumbnaily `_th350` (v src/data-thumb) vynecháváme.
 */
export function extractRemaxGalleryImages(html: string): string[] {
  const $ = cheerio.load(html);
  const images: string[] = [];
  $("#mainImage, a[data-fancybox=\"images\"]").each((_, el) => {
    const href = $(el).attr("href") || $(el).attr("data-src");
    if (href && href.includes("mlsf.remax-czech.cz")) images.push(href);
  });
  return filterImages(images, "remax");
}

function cleanNum(text: string): number | null {
  const m = text.match(/(\d[\d\s\u00a0]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[\s\u00a0]/g, ""));
  return isNaN(n) ? null : n;
}

function roomsFromTitle(title: string): string | null {
  const m = title.match(/(\d+\+kk|\d+\+1|\d\+kk|\d\+1)/i);
  if (m) return m[1].toLowerCase();
  if (/garsonka|atypick/i.test(title)) return "1+kk";
  return null;
}

function areaFromTitle(title: string): number | null {
  const m = title.match(/(\d+)\s*m[²2]/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * REMAX CZ — search inzerátů. Detail je Vue-renderovaný (kontakt přes API),
 * proto se data berou z data-* atributů kartiček na search stránce.
 * Filtruje byty na prodej (types[0]=4 + sale=1), paginace přes `stranka`.
 */
export class RemaxAdapter extends PortalAdapter {
  private maxPages: number;

  constructor(maxPages = 5) {
    super("remax");
    this.maxPages = maxPages;
  }

  async crawlListings(filters?: SearchFilters): Promise<RawListing[]> {
    const results: RawListing[] = [];
    const baseParams = "sale=1&types%5B0%5D=4";

    for (let page = 1; page <= this.maxPages; page++) {
      const url = `${BASE}/reality/vyhledavani/?${baseParams}${page > 1 ? `&stranka=${page}` : ""}`;
      const html = await this.fetch(url);
      const $ = cheerio.load(html);
      const cards = this.parseCards($);
      if (cards.length === 0) break;
      for (const card of cards) results.push(this.toListing(card));
    }

    // Detailní stránka obsahuje plnou galerii (a[data-fancybox="images"] → href)
    // a také popis, patro, stav a GPS — kartička má jen náhled. Zobohacení je
    // pomalé (rate limit 3 s), proto s malou konkurencí jako ostatní adaptéry.
    // Známé inzeráty z DB se přeskočí (skipDetailForUrls).
    return this.enrichBatch(results, (l) => this.enrichListing(l), 3);
  }

  /**
   * Načte detailní stránku inzerátu a doplní údaje, které kartička nemá:
   * všechny fotky galerie, popis, GPS a patro.
   */
  async enrichListing(raw: RawListing): Promise<RawListing> {
    const html = await this.fetch(raw.url);
    const $ = cheerio.load(html);

    const imageUrls = extractRemaxGalleryImages(html);
    if (imageUrls.length > 0) raw.imageUrls = imageUrls;

    // Popis je v collapse bloku („read more") uvnitř .pd-base-info — starý
    // div.text-justify už na detailu není. div[ref="content-inner"] je
    // stabilní napříč inzeráty (1 výskyt na stránce).
    const description = this.cleanText(
      $(".pd-base-info__content-collapse-inner div[ref='content-inner']").first().text()
    );
    if (description && description.length > 20) raw.description = description;

    const address = this.cleanText($(".detail__headline .breadcrumb").last().text());
    if (address && !raw.address) raw.address = address;

    return raw;
  }

  private parseCards($: cheerio.CheerioAPI): RemaxCard[] {
    const cards: RemaxCard[] = [];
    $("div.pl-items__item").each((_i, el) => {
      const $el = $(el);
      const title = this.cleanText($el.attr("data-title") ?? null);
      const url = $el.attr("data-url") || "";
      if (!title || !url) return;
      if (!/(?<!\w)byt(?:u|a|em|y|e)?(?![A-Za-z])|apartm[áa]n/i.test(title)) return;

      const priceText = $el.attr("data-price") || "";
      const price = cleanNum(priceText) ?? 0;
      if (!isValidPrice(price)) return;

      const address = this.cleanText($el.attr("data-display-address") ?? null) || null;

      let lat: number | null = null;
      let lng: number | null = null;
      const gps = $el.attr("data-gps") || "";
      const gpsMatch = gps.match(/(-?\d+)[°\s](\d+)'([\d.]+)"?\s*([NS]),?\s*(-?\d+)[°\s](\d+)'([\d.]+)"?\s*([EW])/i);
      if (gpsMatch) {
        const dmsToDec = (deg: number, min: number, sec: number, dir: string) => {
          let v = deg + min / 60 + sec / 3600;
          if (dir === "S" || dir === "W") v = -v;
          return v;
        };
        lat = dmsToDec(parseInt(gpsMatch[1]), parseInt(gpsMatch[2]), parseFloat(gpsMatch[3]), gpsMatch[4]);
        lng = dmsToDec(parseInt(gpsMatch[5]), parseInt(gpsMatch[6]), parseFloat(gpsMatch[7]), gpsMatch[8]);
      }

      const img = $el.attr("data-img") || null;
      const imgEl = $el.find("img").first();
      const imageUrl = img ?? (imgEl.attr("data-src") || imgEl.attr("src") || null);

      cards.push({
        title,
        url: url.startsWith("http") ? url : `${BASE}${url}`,
        price,
        area: areaFromTitle(title),
        rooms: roomsFromTitle(title),
        address,
        lat,
        lng,
        imageUrl,
      });
    });
    return cards;
  }

  private toListing(card: RemaxCard): RawListing {
    const now = Date.now();
    const area = card.area;
    return {
      portalName: "remax",
      url: card.url,
      title: card.title,
      price: card.price,
      pricePerSqm: area && area > 0 ? Math.round(card.price / area) : null,
      area,
      rooms: card.rooms,
      floor: null,
      condition: null,
      buildingType: null,
      yearBuilt: null,
      address: card.address,
      lat: card.lat,
      lng: card.lng,
      contactPhone: null,
      contactName: null,
      contactEmail: null,
      description: null,
      imageUrls: card.imageUrl ? filterImages([card.imageUrl], this.config.name) : [],
      publishedAt: now,
      updatedAt: now,
    };
  }

  extractContact(_html: string): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }
}
