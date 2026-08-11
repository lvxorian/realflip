import * as cheerio from "cheerio";
import { RawListing, filterImages } from "./types";
import { inferConditionFromText } from "@/lib/analysis/condition";

function cleanText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

function extractPrice(text: string | null): number {
  if (!text) return 0;
  const cleaned = text.replace(/\s/g, "").replace(/Kč.*$/i, "").trim();
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractArea(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/(\d+[,.]?\d*)\s*m[²2]/i);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

function extractRooms(text: string | null): string | null {
  if (!text) return null;
  const patterns = [/(\d+\+[a-z]{2})/i, /(\d+\+1)/i, /garsonk[a-z]*/i];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const v = m[1] ?? m[0];
      return /garsonk[a-z]*/i.test(v) ? "1+kk" : v.toLowerCase();
    }
  }
  return null;
}

const CONDITION_MAP: Record<string, string> = {
  "velmi dobrý": "good",
  "dobrý": "good",
  "špatný": "original",
  "ve výstavbě": "new",
  "novostavba": "new",
  "nový": "new",
  "k demolici": "dilapidated",
  "před rekonstrukcí": "original",
  "po rekonstrukci": "renovated",
  "v rekonstrukci": "original",
  "původní": "original",
};

const BUILDING_TYPE_MAP: Record<string, string> = {
  "cihlová": "brick",
  "kamenná": "brick",
  "dřevěná": "mixed",
  "skeletová": "mixed",
  "smíšená": "mixed",
  "montovaná": "panel",
  "panelová": "panel",
  "modulární": "new",
};

function parseParams($: cheerio.CheerioAPI): {
  area: number | null;
  usableArea: number | null;
  floorArea: number | null;
  rooms: string | null;
  condition: string | null;
  buildingType: string | null;
  floor: number | null;
  yearBuilt: number | null;
} {
  const params: Record<string, string> = {};
  $("ul.detail-information__data li.detail-information__data-item").each((_, row) => {
    const label = (cleanText($(row).find("span").first().text()) ?? "").replace(/:$/, "").trim();
    const value = cleanText($(row).find("span").last().text()) ?? "";
    if (label && value) params[label.toLowerCase()] = value;
  });

  const floorArea = extractArea(params["celková podlahová plocha"] ?? params["podlahová plocha"]) ?? null;
  const usableArea = extractArea(params["užitná plocha"]) ?? null;
  let area = floorArea ?? usableArea;
  if (!area) {
    const titleText = cleanText($("h1.advert-detail-heading__title").first().text()) ?? "";
    area = extractArea(titleText);
  }

  const rooms = extractRooms(cleanText($("h1.advert-detail-heading__title").first().text()));

  const conditionRaw = (params["stav objektu"] ?? params["stav"] ?? "").toLowerCase();
  const condition = CONDITION_MAP[conditionRaw] ?? null;

  const buildingRaw = (params["druh objektu"] ?? params["konstrukce"] ?? "").toLowerCase();
  const buildingType = BUILDING_TYPE_MAP[buildingRaw] ?? null;

  let floor: number | null = null;
  const floorStr = params["číslo podlaží v domě"] ?? params["podlaží"] ?? "";
  const fm = floorStr.match(/^(\d+)/);
  if (fm) floor = parseInt(fm[1]);

  let yearBuilt: number | null = null;
  const yearStr = params["rok kolaudace"] ?? params["rok výstavby"] ?? "";
  if (yearStr) {
    const ym = yearStr.match(/(\d{4})/);
    if (ym) yearBuilt = parseInt(ym[1]);
  }

  return { area, usableArea, floorArea, rooms, condition, buildingType, floor, yearBuilt };
}

function parseContact($: cheerio.CheerioAPI): {
  name: string | null;
  phone: string | null;
  email: string | null;
} {
  const name = cleanText($(".offer-detail-sidebar__agent p a").first().text());

  let phone: string | null = null;
  $('a[rel="nofollow"][href^="/trackredir/"]').each((_, el) => {
    const text = cleanText($(el).text());
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

  return { name, phone: phone || null, email };
}

/**
 * Vytáhne všechny fotky galerie ze stránky realitymix.cz.
 *
 * Skutečná galerie má tři části:
 * - `.gallery__main-img` — hlavní (velká) fotka,
 * - `.gallery__small-img .gallery__item a` — viditelné náhledy (plná verze v `data-src`),
 * - `.gallery__hidden-items a.gallery__item` — zbývající fotky (plná verze v `href`).
 *
 * Původně se hledalo `.gallery__items`, který na stránce neexistuje — proto měly
 * všechny realitymix inzeráty jen ~3 fotky. Bereme `href` přednostně (plná verze),
 * jinak `data-src`; `_nahled` (malé náhledy) a `_detail` (menší verze) filtrujeme
 * a http:// st.realitymix.cz převádíme na https (stejný obrázek, bez mixed contentu).
 */
export function extractRealityMixImages($: cheerio.CheerioAPI): string[] {
  const images: string[] = [];
  $(".gallery__main-img a[data-gallery], .gallery__small-img a[data-gallery], .gallery__hidden-items a.gallery__item").each((_, el) => {
    const href = $(el).attr("href");
    const dataSrc = $(el).attr("data-src");
    const src = href ?? dataSrc;
    if (src) {
      // Plná verze bez thumbnailu/detailu; ostatní portály řeší vlastní logikou.
      images.push(
        src
          .replace(/^http:/, "https:")
          .replace(/_detail\.(jpe?g|png|webp)$/i, ".$1")
          .replace(/_nahled\.(jpe?g|png|webp)$/i, ".$1")
      );
    }
  });
  return filterImages(images, "realitymix");
}

export function parseRealityMixDetail(html: string, url: string): RawListing {
  const $ = cheerio.load(html);

  const title = cleanText($("h1.advert-detail-heading__title").first().text()) ?? "";

  const price = extractPrice(cleanText($(".advert-detail-heading__price-value").first().text()));

  let address = cleanText($(".advert-detail-heading__address").first().text()) ?? null;
  if (!address) {
    address = cleanText($("#print-map").attr("data-address")) ?? null;
  }
  if (!address) address = title;

  const { area, usableArea, floorArea, rooms, condition, buildingType, floor, yearBuilt } = parseParams($);

  let description: string | null = null;
  const descEl = $(".advert-description__text-inner").first();
  if (descEl.length) description = descEl.text().replace(/\s+/g, " ").trim();
  if (!description) description = cleanText($('meta[property="og:description"]').attr("content"));

  const imageUrls = extractRealityMixImages($);

  const latAttr = $("#print-map").attr("data-gps-lat");
  const lngAttr = $("#print-map").attr("data-gps-lon");
  const lat = latAttr && latAttr.trim() !== "" ? parseFloat(latAttr) : null;
  const lng = lngAttr && lngAttr.trim() !== "" ? parseFloat(lngAttr) : null;

  const contact = parseContact($);

  const effectiveCondition = condition ?? inferConditionFromText(description, title) ?? null;

  const now = Date.now();
  return {
    portalName: "realitymix",
    url,
    title,
    price,
    pricePerSqm: price > 0 && area && area > 0 ? Math.round(price / area) : null,
    area,
    usableArea,
    floorArea,
    rooms,
    floor,
    condition: effectiveCondition,
    buildingType,
    yearBuilt,
    address,
    lat,
    lng,
    contactPhone: contact.phone,
    contactName: contact.name,
    contactEmail: contact.email,
    description,
    imageUrls,
    publishedAt: now,
    updatedAt: now,
  };
}
