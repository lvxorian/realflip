import zlib from "zlib";
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

    // ISIR document URLs are PDF *portfolios*: the visible page only contains
    // a short "open in a full reader" boilerplate. The real content (databox
    // delivery receipts, internal "referát" notes, decision metadata) lives in
    // embedded files inside the container. Parse those so we surface something
    // meaningful instead of the boilerplate.
    const raw = buffer.toString("latin1");
    const embedded = extractEmbeddedPdfs(raw);

    let text = "";
    if (embedded.length > 0) {
      const parts: string[] = [];
      for (const pdf of embedded) {
        try {
          const t = await parseBufferText(pdf);
          if (t) parts.push(t);
        } catch {
          // skip unparseable embedded pdf
        }
      }
      text = parts.join("\n\n---\n\n").trim();
    }

    if (!text) {
      try {
        text = await parseBufferText(buffer);
      } catch {
        text = "";
      }
    }

    return { text, success: true };
  } catch (err) {
    console.warn("[ISIR] PDF parse failed:", err);
    return { text: "", success: false };
  }
}

async function parseBufferText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  return result.text;
}

function inflateStream(data: Buffer): Buffer {
  if (data[0] === 0x0d && data[1] === 0x0a) data = data.slice(2);
  else if (data[0] === 0x0a) data = data.slice(1);
  try {
    return zlib.inflateSync(data);
  } catch {
    return data;
  }
}

function extractEmbeddedPdfs(raw: string): Buffer[] {
  const out: Buffer[] = [];
  let idx = -1;
  while ((idx = raw.indexOf("/Type/EmbeddedFile", idx + 1)) !== -1) {
    const dictStart = raw.lastIndexOf("<<", idx);
    const dictEnd = raw.indexOf(">>", idx);
    if (dictStart < 0 || dictEnd < 0) continue;
    const si = raw.indexOf("stream\n", dictEnd + 2);
    if (si === -1) continue;
    const es = raw.indexOf("endstream", si + 7);
    if (es === -1) continue;
    const data = inflateStream(Buffer.from(raw.slice(si + 7, es), "latin1"));
    if (data.slice(0, 4).toString("hex") === "25504446") out.push(data);
  }
  return out;
}

export function extractApartmentFromPdf(pdfText: string): ApartmentData | null {
  if (!hasApartmentReference(pdfText)) return null;
  return parseApartmentFromText(pdfText);
}
