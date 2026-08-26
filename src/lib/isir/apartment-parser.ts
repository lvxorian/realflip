import type { ApartmentData } from "./types";

const APARTMENT_REGEX =
  /(bytov[aá]\s+jednotk[aá]|jednotk[ay]\s+č\.|byt\s+č\.|dispozic[ei]\s+[1-5]\s*(\+|\/)\s*(kk|[0-9])|1\+kk|2\+kk|3\+kk|4\+kk|5\+kk|1\+1|2\+1|3\+1|4\+1|5\+1|garsoni[eé]r[aá])/i;

const DISPOSITION_REGEX =
  /(1\+kk|2\+kk|3\+kk|4\+kk|5\+kk|1\+1|2\+1|3\+1|4\+1|5\+1|garsoni[eé]r[aá]|dispozic[ei]\s+[1-5]\s*(\+|\/)\s*(kk|[0-9]))/i;

const AREA_REGEX = /(\d+(?:[.,]\d+)?)\s*m[²2]/;

const LV_REGEX = /(?:LV|list\s+vlastnictv[ií])\s*(?:č\.?)?\s*(\d+)/i;

const CADASTRAL_REGEX = /k\.\s*[úu]\.?\s*([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž\s-]+?)(?:\s*[,.]|\s*$)/;

const PRICE_REGEX = /(\d[\d\s]*(?:\s*\d{3})*)\s*(?:Kč|CZK|,-)/;

const ADDRESS_STREET_REGEX =
  /(?:ul(?:ice)?\.?)\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž]+\s*\d+[a-záčďéěíňóřšťúůýž]?)/i;

export function extractDisposition(text: string): string | null {
  const match = text.match(DISPOSITION_REGEX);
  if (!match) return null;
  const raw = match[0].toLowerCase();
  if (raw.startsWith("dispoz")) {
    const inner = raw.match(/([1-5])\s*(\+|\/)\s*(kk|[0-9])/);
    if (inner) return `${inner[1]}+${inner[3] === "kk" ? "kk" : inner[3]}`;
  }
  if (raw.includes("garson")) return "garsoniéra";
  return raw.replace(/\s+/g, "");
}

export function extractArea(text: string): number | null {
  const match = text.match(AREA_REGEX);
  if (!match) return null;
  const num = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

export function extractLvNumber(text: string): string | null {
  const match = text.match(LV_REGEX);
  return match ? match[1] : null;
}

export function extractCadastralArea(text: string): string | null {
  const match = text.match(CADASTRAL_REGEX);
  if (!match) return null;
  return match[1].trim().replace(/\s+$/, "");
}

export function extractEstimatedPrice(text: string): number | null {
  const match = text.match(PRICE_REGEX);
  if (!match) return null;
  const digits = match[1].replace(/\s/g, "");
  const num = parseInt(digits, 10);
  return Number.isFinite(num) && num > 10000 ? num : null;
}

export function extractAddress(text: string): string | null {
  const streetMatch = text.match(ADDRESS_STREET_REGEX);
  if (streetMatch) return streetMatch[0].trim();

  return null;
}

export function hasApartmentReference(text: string): boolean {
  return APARTMENT_REGEX.test(text);
}

export function parseApartmentFromText(text: string): ApartmentData {
  return {
    address: extractAddress(text),
    disposition: extractDisposition(text),
    area: extractArea(text),
    cadastralArea: extractCadastralArea(text),
    lvNumber: extractLvNumber(text),
    estimatedPrice: extractEstimatedPrice(text),
    rawText: text.slice(0, 2000),
  };
}

export async function parsePdfFromUrl(url: string): Promise<{ text: string; success: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`PDF download failed: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);

    return { text: data.text, success: true };
  } catch (err) {
    console.warn("[ISIR] PDF parse failed:", err);
    return { text: "", success: false };
  }
}

export function extractApartmentFromPdf(pdfText: string): ApartmentData | null {
  if (!hasApartmentReference(pdfText)) return null;
  return parseApartmentFromText(pdfText);
}
