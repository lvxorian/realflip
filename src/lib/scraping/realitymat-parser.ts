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

function parseContact($: cheerio.CheerioAPI): {
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

  let phone: string | null = null;
  const modalText = cleanText($("#seller-modal").text()) ?? "";
  const phoneMatch = modalText.match(/\+?\d{3}\s*\d{3}\s*\d{3}\s*\d{3}/);
  if (phoneMatch) phone = phoneMatch[0].replace(/\s+/g, "");

  let email: string | null = null;
  const mailMatch = modalText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (mailMatch) email = mailMatch[0];

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

  const contact = parseContact($);

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
