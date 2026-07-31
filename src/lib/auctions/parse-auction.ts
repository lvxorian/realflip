import { GoogleGenAI } from "@google/genai";

/**
 * Pipeline pro automatickou due diligence dražeb z portaldrazeb.cz.
 *
 * Aktuálně NENÍ volána (endpoint /api/parse-auction vrací mock data).
 * Níže jsou připravené typované kostry funkcí + popis integrace.
 *
 * Pořadí nasazení:
 * 1. fetchDetailPage(url)        – stáhnout HTML detailu dražby
 * 2. extractPdfLinks(html)       – najít PDF: Dražební vyhláška + Znalecký posudek
 * 3. downloadPdfBuffers(links)   – stáhnout oba PDF do bufferů (pozor na CORS – probíhá na serveru)
 * 4. extractWithGemini(buffers)  – LLM extrakce strukturovaných dat (nativní OCR naskenovaných PDF)
 */

export interface AuctionDocument {
  type: "vyhlaska" | "posudek" | "other";
  url: string;
}

export interface ParsedAuction {
  title: string;
  address: string | null;
  appraisalPrice: number | null;
  minimumBid: number | null;
  auctionDate: string | null;
  documents: AuctionDocument[];
}

export interface ParseAuctionResult {
  sourceUrl: string;
  parsed: ParsedAuction;
}

/**
 * 1. Stáhne HTML stránku detailu dražby.
 * TODO: server-side fetch (route handler) – vyřeší CORS.
 * Vzor ostatních scraperů: src/lib/scraping/adapters/base.ts
 */
export async function fetchDetailPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`Detail dražby nedostupný (HTTP ${response.status})`);
  return response.text();
}

/**
 * 2. Prohledá HTML a najde odkazy na PDF dokumenty.
 * Typicky: /dokumenty/...vyhlaska..., /dokumenty/...posudek...
 * TODO: parsovat HTML (př. cheerio nebo regex na href) a vyplnit typy:
 *   - URL obsahující "vyhlaska" -> { type: "vyhlaska" }
 *   - URL obsahující "posudek"  -> { type: "posudek" }
 *   - ostatní PDF               -> { type: "other" }
 */
export function extractPdfLinks(html: string): AuctionDocument[] {
  // TODO: implementace – extrahovat odkazy z HTML
  const links: AuctionDocument[] = [];
  return links;
}

/**
 * 3. Stáhne PDF dokumenty do bufferů (vše probíhá na serveru).
 * TODO: mapovat extractPdfLinks() výsledky přes fetch(url).arrayBuffer()
 */
export async function downloadPdfBuffers(links: AuctionDocument[]): Promise<{ doc: AuctionDocument; buffer: ArrayBuffer }[]> {
  const results = await Promise.all(
    links.map(async (doc) => {
      const response = await fetch(doc.url);
      if (!response.ok) throw new Error(`PDF nedostupné (${doc.url})`);
      return { doc, buffer: await response.arrayBuffer() };
    })
  );
  return results;
}

/**
 * 4. LLM extrakce dat z PDF (Dražební vyhláška + Znalecký posudek).
 * Používá GEMINI_API_KEY (viz src/lib/ai/analyzer.ts – stejný vzor volání).
 *
 * Vzor pro připojení PDF jako dokumentu (gemini-2.5-flash má nativní OCR
 * naskenovaných PDF, není potřeba samostatný OCR model):
 *
 *   const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
 *   const base64 = Buffer.from(buffer).toString("base64");
 *   const response = await client.models.generateContent({
 *     model: "gemini-2.5-flash",
 *     contents: [{ role: "user", parts: [
 *       { text: "Načti z přiložených dokumentů dražby: ..." },
 *       { inlineData: { mimeType: "application/pdf", data: base64 } },
 *     ] }],
 *     config: { responseMimeType: "application/json", temperature: 0.1 },
 *   });
 *
 * TODO: implementovat; JSON výstup mapovat na ParsedAuction (title, address,
 * appraisalPrice=OC, minimumBid=NP, auctionDate, documents).
 */
export async function extractWithGemini(
  documents: { doc: AuctionDocument; buffer: ArrayBuffer }[]
): Promise<ParsedAuction> {
  void documents;
  throw new Error("Není implementováno – čeká na napojení LLM extrakce");
}

/**
 * Hlavní vstup: kompletní pipeline. Route handler by měl volat tuto funkci.
 */
export async function parseAuction(url: string): Promise<ParseAuctionResult> {
  const html = await fetchDetailPage(url);
  const links = extractPdfLinks(html);
  const pdfs = await downloadPdfBuffers(links);
  const parsed = await extractWithGemini(pdfs);
  return { sourceUrl: url, parsed };
}
