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
  const patterns = [/(\d+\+[a-z]{2})/i, /(\d+\+1)/i, /garsonk[a-z]*/i, /atypick[eé]ho/i];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const v = m[1] ?? m[0];
      return /garsonk[a-z]*|atypick[eé]ho/i.test(v) ? "1+kk" : v.toLowerCase();
    }
  }
  return null;
}

const CONDITION_MAP: Record<string, string> = {
  "velmi dobrý": "good",
  "dobrý": "good",
  "špatný": "original",
  "ve výstavbě": "new",
  "projekt": "original",
  "novostavba": "new",
  "k demolici": "dilapidated",
  "před rekonstrukcí": "original",
  "po rekonstrukci": "renovated",
  "v rekonstrukci": "original",
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

interface DetailParams {
  area: number | null;
  usableArea: number | null;
  floorArea: number | null;
  rooms: string | null;
  condition: string | null;
  buildingType: string | null;
  floor: number | null;
}

function parseParams($: cheerio.CheerioAPI): DetailParams {
  const params: Record<string, string> = {};
  $("#detail-information div.row.mb-2").each((_, row) => {
    const label = cleanText($(row).find("div.col.font-weight-bolder").text()) ?? "";
    const value = cleanText($(row).find("div.col span").text()) ?? "";
    if (label) params[label.toLowerCase()] = value;
  });

  const usableArea = extractArea(params["užitná plocha"]) ?? null;
  const floorArea = extractArea(params["podlahová plocha"]) ?? null;
  let area = usableArea ?? floorArea;
  if (!area) {
    const titleText = cleanText($("h1").first().text()) ?? "";
    area = extractArea(titleText);
  }

  const rooms = extractRooms(cleanText($("h1").first().text()));

  const conditionRaw = (params["stav objektu"] ?? "").toLowerCase();
  const condition = CONDITION_MAP[conditionRaw] ?? null;

  const buildingRaw = (params["stavba"] ?? "").toLowerCase();
  const buildingType = BUILDING_TYPE_MAP[buildingRaw] ?? null;

  let floor: number | null = null;
  const floorStr = params["patro"] ?? "";
  const fm = floorStr.match(/(\d+)\s*\./);
  if (fm) floor = parseInt(fm[1]);

  return { area, usableArea, floorArea, rooms, condition, buildingType, floor };
}

/**
 * Sdílená extrakce kontaktu z detailní stránky realitymat.cz.
 * Plné telefonní číslo je v #seller-modal server-renderované (tlačítko
 * "(zobrazit)" jen otevírá Bootstrap modal) — žádný AJAX/klik není potřeba.
 */
export function parseRealityMatContact($: cheerio.CheerioAPI): {
  name: string | null;
  phone: string | null;
  email: string | null;
} {
  let name: string | null = null;
  const nameEl = $("a[href^='/realitni-makleri/']").first();
  if (nameEl.length) {
    name = cleanText(nameEl.text());
  }
  if (!name) {
    name = cleanText($("#seller-modal .media-body p").first().text());
  }

  // Telefon: prioritně blok u ikony telefonu (makléř), fallback celý modal.
  // Normalizace: 9 číslic (CZ) případně s předvolbou +420 / 00420 / 0 → +420{9}.
  let phone: string | null = null;
  const phoneEl = $("#seller-modal i.fa-phone").first().parent();
  if (phoneEl.length) {
    const digits = (cleanText(phoneEl.text()) ?? "").replace(/\D/g, "");
    const m = digits.match(/^(?:00420|\+?420)?0?(\d{9})$/);
    if (m) phone = `+420${m[1]}`;
  }
  if (!phone) {
    const modalRaw = (cleanText($("#seller-modal").text()) ?? "").replace(/\s+/g, "");
    const m = modalRaw.match(/(?:00420|\+?420)?0?(\d{9})(?!\d)/);
    if (m) phone = `+420${m[1]}`;
  }

  // Realitymat nezveřejňuje e-mail makléře — v modalu je jen obecný
  // info@realitymat.cz (GDPR text). Ten se jako kontakt neukládá.
  let email: string | null = null;
  const modalText = cleanText($("#seller-modal").text()) ?? "";
  const mailMatch = modalText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (mailMatch) {
    const candidate = mailMatch[0].replace(/\.+$/, "").toLowerCase();
    if (!/^info@realitymat\.cz$/.test(candidate)) email = candidate;
  }

  return { name, phone, email };
}

export function parseRealityMatDetail(html: string, url: string): RawListing {
  const $ = cheerio.load(html);

  const title = cleanText($("h1").first().text()) ?? cleanText($('meta[property="og:title"]').attr("content")) ?? "";

  let price = extractPrice(cleanText($("div.d-inline-block.mb-2 span.h2").first().text()));
  if (!price) {
    price = extractPrice(cleanText($("#detail-information div.row.mb-2").first().find("span").text()));
  }

  const address = cleanText($("p.text-muted.mb-2").first().text().replace(/^[\s\S]*?fa-map-marker-alt[\s\S]*?<\/i>\s*/, "")) ?? title;

  const { area, usableArea, floorArea, rooms, condition, buildingType, floor } = parseParams($);

  let description: string | null = null;
  const descEl = $("div.col-lg-6.text-justify p.text-break").first();
  if (descEl.length) description = descEl.text().replace(/\s+/g, " ").trim();
  if (!description) description = cleanText($('meta[property="og:description"]').attr("content"));

  const images: string[] = [];
  $("#carousel-photo .carousel-item img").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src");
    if (src && !src.startsWith("data:image")) images.push(src);
  });
  const imageUrls = filterImages(images, "realitymat");

  const contact = parseRealityMatContact($);

  const effectiveCondition = condition ?? inferConditionFromText(description, title) ?? null;

  const now = Date.now();
  return {
    portalName: "realitymat",
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
    yearBuilt: null,
    address,
    lat: null,
    lng: null,
    contactPhone: contact.phone,
    contactName: contact.name,
    contactEmail: contact.email,
    description,
    imageUrls,
    publishedAt: now,
    updatedAt: now,
  };
}
