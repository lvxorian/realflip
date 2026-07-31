import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "@/lib/ai/gemini";

/**
 * Pipeline pro automatickou due diligence dražeb z portaldrazeb.cz.
 *
 * Detail dražby je dostupný jako JSON na https://www.portaldrazeb.cz/drazba/{slug}.json
 * (stránka je client-side renderovaná Vue, parsovat HTML není potřeba).
 *
 * Ověřeno (live):
 * - OC   = estimated_price
 * - NP   = item_price
 * - Fotky = /media/cache/thumb_large + image.pathname  (HTTP 200, image/jpeg)
 * - PDF dokumenty (vyhláška, znalecký posudek) vyžadují přihlášeného uživatele –
 *   při selhání stahování pipeline pokračuje s JSON daty (fallback).
 */

const THUMB_BASE = "https://www.portaldrazeb.cz/media/cache/thumb_large";
const ORIGIN = "https://www.portaldrazeb.cz";

export interface AuctionDocument {
  type: "vyhlaska" | "posudek" | "other";
  url: string;
}

export interface AuctionDebtor {
  name: string | null;
  address: string | null;
}

export interface AuctionExekutor {
  name: string | null;
  phone: string | null;
  email: string | null;
  district: string | null;
}

export interface ParsedAuction {
  title: string;
  address: string | null;
  district: string | null;
  county: string | null;
  appraisalPrice: number | null;
  minimumBid: number | null;
  auctionDate: string | null;
  caseNumber: string | null;
  auctioneer: AuctionExekutor | null;
  debtor: AuctionDebtor | null;
  area: number | null;
  rooms: string | null;
  condition: string | null;
  debtEstimate: number | null;
  liens: string[];
  description: string | null;
  documents: AuctionDocument[];
  imageUrls: string[];
  sourceUrl: string;
}

export interface ParseAuctionResult {
  sourceUrl: string;
  parsed: ParsedAuction;
}

interface RawAuctionJson {
  number?: string | null;
  estimated_price?: number | null;
  item_price?: number | null;
  start_at?: string | null;
  status?: string | null;
  link?: string | null;
  documents?: Record<string, RawDocument>;
  images?: Record<string, RawImage>;
  auctioneer_office?: {
    title?: string | null;
    district?: string | null;
    default_address?: {
      phone_number?: string | null;
      email?: string | null;
    } | null;
  };
  item?: {
    title?: string | null;
    description?: string | null;
    description_plaintext?: string | null;
    category?: { full_path?: string | null; title?: string | null } | null;
    location_district?: {
      district_name?: string | null;
      county?: { county_name?: string | null } | null;
      city?: { city_name?: string | null } | null;
    } | null;
    location_coords?: { latitude?: number | null; longitude?: number | null } | null;
    ruian?: {
      house_number?: string | null;
      street?: string | null;
      city_name?: string | null;
      district_name?: string | null;
    } | null;
  };
}

interface RawDocument {
  mime_type?: string | null;
  original_name?: string | null;
  hash?: string | null;
  document_type?: string | null;
}

interface RawImage {
  pathname?: string | null;
  priority?: number | null;
}

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }
  return _client;
}

/** Z URL `/drazba/{slug}` extrahuje slug; přijímá i `/detail/...` varianty. */
export function extractSlug(url: string): string | null {
  const m = url.match(/\/drazba\/([a-z0-9-]+)/i) || url.match(/\/detail\/([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

/**
 * 1. Stáhne JSON detailu dražby z portaldrazeb.cz.
 */
export async function fetchAuctionData(url: string): Promise<RawAuctionJson> {
  const slug = extractSlug(url);
  if (!slug) throw new Error("Neplatný odkaz na dražbu");
  const apiUrl = `${ORIGIN}/drazba/${slug}.json`;
  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Detail dražby nedostupný (HTTP ${response.status})`);
  const json = await response.json().catch(() => {
    throw new Error("Nepodařilo se přečíst data dražby");
  });
  return json as RawAuctionJson;
}

/** 2. Najde PDF dokumenty v JSON odpovědi (vyhláška + znalecký posudek). */
export function extractPdfLinks(data: RawAuctionJson): AuctionDocument[] {
  const docs: AuctionDocument[] = [];
  const documents = data.documents ?? {};
  for (const key of Object.keys(documents)) {
    const doc = documents[key];
    if (!doc || doc.mime_type !== "application/pdf") continue;
    const type =
      doc.document_type === "auction_decree"
        ? "vyhlaska"
        : doc.document_type === "expert_report"
          ? "posudek"
          : "other";
    const hash = doc.hash ?? key;
    docs.push({ type, url: `${ORIGIN}/dokumenty/${hash}` });
  }
  // Prioritizovat vyhlášku a posudek
  docs.sort((a, b) => {
    const order: Record<string, number> = { vyhlaska: 0, posudek: 1, other: 2 };
    return (order[a.type] ?? 2) - (order[b.type] ?? 2);
  });
  return docs;
}

/** 3. Stáhne PDF dokumenty; selhání se tiše přeskočí (dokumenty mohou vyžadovat login). */
export async function downloadPdfBuffers(
  links: AuctionDocument[]
): Promise<{ doc: AuctionDocument; buffer: ArrayBuffer }[]> {
  const results: { doc: AuctionDocument; buffer: ArrayBuffer }[] = [];
  await Promise.all(
    links.map(async (doc) => {
      try {
        const response = await fetch(doc.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
        });
        if (!response.ok) return;
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("pdf")) return;
        results.push({ doc, buffer: await response.arrayBuffer() });
      } catch {
        // PDF nedostupné – fallback na JSON data
      }
    })
  );
  return results;
}

/** Sestaví URL fotek dražby z JSON (thumb_large je veřejně dostupný). */
export function buildImageUrls(data: RawAuctionJson): string[] {
  const images = data.images ?? {};
  const list = Object.values(images)
    .filter((img): img is RawImage => Boolean(img && img.pathname))
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  return list
    .slice(0, 20)
    .map((img) => `${THUMB_BASE}${img.pathname}`);
}

function inferAddress(data: RawAuctionJson): string | null {
  const ruian = data.item?.ruian;
  const district = data.item?.location_district;
  if (ruian) {
    const parts = [ruian.street ? `${ruian.street} ${ruian.house_number ?? ""}`.trim() : null, ruian.city_name, ruian.district_name]
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  if (district?.city?.city_name) return district.city.city_name;
  return null;
}

function inferRooms(title: string | null): string | null {
  if (!title) return null;
  const m = title.match(/(\d\+\d+(?:\/kk|kk)?|\d\+\d+|2\+1|3\+1|4\+1|1\+kk|1\+1|garsonk[a-z]*)/i);
  return m ? m[1] : null;
}

/**
 * Fallback extrakce plochy z popisu nemovitosti (funguje i bez AI/PDF).
 * Hledá vzory typu "užitná plocha ... 38 m²", "plocha jednotky je 38 m2",
 * "zastavěná plocha ... m²" apod. Bere první věrohodnou hodnotu (typicky jednotka).
 */
export function extractAreaFromDescription(description: string | null): number | null {
  if (!description) return null;
  const text = description.replace(/\u00a0/g, " ").toLowerCase();

  // Užitná/podlahová plocha – ohebný kmen "ploch" pokryje skloňování (plocha, ploše, plochy…)
  const unitKeywords =
    /(?:u\u017eitn|podlahov|plocha jednotky|plocha bytu|v\u00fdm\u011bra jednotky|v\u00fdm\u011bra bytu)/;
  // m2 i m² (horní index)
  const m2 = "m\\s*(?:\\u00b2|2)";
  const unitPatterns = [
    new RegExp(unitKeywords.source + ".{0,60}?(\\d{1,4}(?:[.,]\\d+)?)\\s*" + m2),
    new RegExp("(\\d{1,4}(?:[.,]\\d+)?)\\s*" + m2 + ".{0,40}" + unitKeywords.source),
  ];
  for (const re of unitPatterns) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(m[1].replace(",", "."));
      if (v > 5 && v < 2000) return Math.round(v);
    }
  }

  // Obecný vzor "plocha ... X m²"
  const generic = text.match(new RegExp("(?:plocha|v\\u00fdm\\u011bra|rozloha).{0,40}?(\\d{1,4}(?:[.,]\\d+)?)\\s*" + m2));
  if (generic) {
    const v = parseFloat(generic[1].replace(",", "."));
    if (v > 5 && v < 2000) return Math.round(v);
  }

  return null;
}

/** 4. LLM extrakce rozšířených dat z popisu + PDF (dlužník, stav, plocha, dluhy). Fallback = null. */
export async function extractWithGemini(
  data: RawAuctionJson,
  pdfs: { doc: AuctionDocument; buffer: ArrayBuffer }[]
): Promise<Partial<ParsedAuction>> {
  const description = data.item?.description_plaintext ?? data.item?.description ?? "";
  const title = data.item?.title ?? "";

  if (!process.env.GEMINI_API_KEY) {
    return {};
  }

  const pdfParts = pdfs.slice(0, 2).map(({ doc, buffer }) => ({
    text: `[Dokument: ${doc.type === "vyhlaska" ? "Dražební vyhláška" : "Znalecký posudek"}]`,
    inlineData: {
      mimeType: "application/pdf" as const,
      data: Buffer.from(buffer).toString("base64"),
    },
  }));

  const prompt = `Z níže uvedených podkladů exekuční dražby nemovitosti extrahuj strukturovaná data.
ODPOVÍDEJ VÝHRADNĚ JSON bez komentářů.

Podklady:
Název: ${title}
Popis: ${description.slice(0, 8000)}
${pdfParts.length ? "Přiložené PDF dokumenty (dražební vyhláška, znalecký posudek): parsuj jejich text." : ""}

Formát JSON:
{
  "debtor": { "name": string|null, "address": string|null },
  "areaSqm": number|null,
  "rooms": string|null,
  "condition": "novostavba"|"po rekonstrukci"|"dobrý"|"původní"|"zchátralý"|null,
  "debtEstimate": number|null,
  "liens": string[],
  "summary": "2-3 věty o stavu a potenciálu nemovitosti česky"
}

Pravidla:
- debtor = povinný/dlužník z dražební vyhlášky (jméno, případně adresa), jinak null
- areaSqm = užitná/obestavěná plocha z posudku/popisu (celá čísla)
- condition podle technického stavu
- debtEstimate = součet dluhů/pohledávek z vyhlášky v Kč, jinak null
- liens = věcná břemena, zástavy, exekuce (pole textů), jinak prázdné pole`;

  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }, ...pdfParts] }],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    const text = response.text;
    if (!text) return {};
    const parsed = JSON.parse(text) as {
      debtor?: { name?: string | null; address?: string | null } | null;
      areaSqm?: number | null;
      rooms?: string | null;
      condition?: string | null;
      debtEstimate?: number | null;
      liens?: string[];
      summary?: string;
    };
    const conditionMap: Record<string, string> = {
      novostavba: "new",
      "po rekonstrukci": "renovated",
      "dobrý": "good",
      "původní": "original",
      "zchátralý": "dilapidated",
    };
    return {
      debtor: parsed.debtor?.name
        ? { name: parsed.debtor.name, address: parsed.debtor.address ?? null }
        : null,
      area: typeof parsed.areaSqm === "number" && parsed.areaSqm > 0 ? parsed.areaSqm : null,
      rooms: parsed.rooms ?? null,
      condition: parsed.condition ? conditionMap[parsed.condition] ?? null : null,
      debtEstimate: typeof parsed.debtEstimate === "number" && parsed.debtEstimate > 0 ? parsed.debtEstimate : null,
      liens: Array.isArray(parsed.liens) ? parsed.liens : [],
      description: parsed.summary ? `${parsed.summary}\n\n${description}`.trim() : null,
    };
  } catch (error) {
    console.error("Auction AI extraction error:", error);
    return {};
  }
}

/**
 * Hlavní vstup: kompletní pipeline.
 */
export async function parseAuction(url: string): Promise<ParseAuctionResult> {
  const data = await fetchAuctionData(url);
  const documents = extractPdfLinks(data);
  const pdfs = await downloadPdfBuffers(documents);
  const ai = await extractWithGemini(data, pdfs);

  const address = inferAddress(data);
  const district = data.item?.location_district?.district_name ?? null;
  const county = data.item?.location_district?.county?.county_name ?? null;
  const title = data.item?.title ?? "Dražba – nemovitost";
  const exekutorOffice = data.auctioneer_office;
  const rawDescription = data.item?.description_plaintext ?? null;

  // Plocha: AI → regex fallback z popisu → null
  const area = ai.area ?? extractAreaFromDescription(rawDescription);

  const parsed: ParsedAuction = {
    title,
    address: ai.debtor?.address ?? address,
    district,
    county,
    appraisalPrice: data.estimated_price ?? null,
    minimumBid: data.item_price ?? null,
    auctionDate: data.start_at ?? null,
    caseNumber: data.number ?? null,
    auctioneer: exekutorOffice
      ? {
          name: exekutorOffice.title ?? null,
          phone: exekutorOffice.default_address?.phone_number ?? null,
          email: exekutorOffice.default_address?.email ?? null,
          district: exekutorOffice.district ?? null,
        }
      : null,
    debtor: ai.debtor ?? null,
    area,
    rooms: ai.rooms ?? inferRooms(title),
    condition: ai.condition ?? null,
    debtEstimate: ai.debtEstimate ?? null,
    liens: ai.liens ?? [],
    description: ai.description ?? rawDescription,
    documents,
    imageUrls: buildImageUrls(data),
    sourceUrl: url,
  };

  return { sourceUrl: url, parsed };
}
