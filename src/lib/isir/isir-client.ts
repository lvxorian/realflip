import { XMLParser } from "fast-xml-parser";
import { delay } from "@/lib/utils";
import type { IsirEventData } from "./types";

const BASE_URL = "https://isir.justice.cz:8443/isir_public_ws/IsirWsPublicService";
const REQUEST_DELAY_MS = 2500;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name) => name === "data" || name === "cisloPosledniId",
  parseTagValue: true,
  trimValues: true,
});

function cleanXmlNamespaces(xml: string): string {
  return xml.replace(/ns2:/g, "").replace(/xmlns:ns2="[^"]*"/g, "");
}

function buildSoapEnvelope(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:isir="http://isirpublicws.cca.cz/types/">
  <soap:Header/>
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;
}

async function soapRequest(bodyXml: string): Promise<string> {
  const envelope = buildSoapEnvelope(bodyXml);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8" },
        body: envelope,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`ISIR HTTP ${res.status}: ${text.slice(0, 300)}`);
      }

      const rawXml = await res.text();
      return cleanXmlNamespaces(rawXml);
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      if (isLast) throw err;
      const backoff = attempt * 2000;
      console.warn(`[ISIR] attempt ${attempt} failed, retrying in ${backoff}ms...`);
      await delay(backoff);
    }
  }

  throw new Error("ISIR: unreachable");
}

function parseSoapBody(xml: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: any = parser.parse(xml);
  const body = parsed?.["soap:Envelope"]?.["soap:Body"];
  if (!body) throw new Error("ISIR: empty SOAP body");
  return body;
}

export async function getLastPodnetId(): Promise<number> {
  const xml = await soapRequest(
    `<isir:getIsirWsPublicPosledniIdDataRequest/>`
  );

  const body = parseSoapBody(xml);
  const resp = body.getIsirWsPublicPosledniDataResponse;
  if (!resp) throw new Error("ISIR: unexpected response structure");

  if (resp.status?.stav !== "OK") {
    throw new Error(`ISIR API error: ${resp.status?.popisChyby ?? resp.status?.kodChyby ?? "unknown"}`);
  }

  const ids = resp.cisloPosledniId;
  if (!ids || ids.length === 0) {
    throw new Error("ISIR: no last ID returned");
  }

  return Math.max(...ids.map((id: number | string) => Number(id)));
}

export async function getEventData(podnetId: number): Promise<IsirEventData[]> {
  const xml = await soapRequest(
    `<isir:getIsirWsPublicIdDataRequest>
      <idPodnetu>${podnetId}</idPodnetu>
    </isir:getIsirWsPublicIdDataRequest>`
  );

  const body = parseSoapBody(xml);
  const resp = body.getIsirWsPublicDataResponse;
  if (!resp) return [];

  if (resp.status?.stav !== "OK") {
    const msg = resp.status?.popisChyby ?? resp.status?.kodChyby ?? "unknown";
    if (String(msg).includes("N") || String(msg).includes("nenalezen")) return [];
    throw new Error(`ISIR API error for ID ${podnetId}: ${msg}`);
  }

  const events = Array.isArray(resp.data) ? resp.data : resp.data ? [resp.data] : [];
  return events.map((e: Record<string, string | number>) => ({
    id: Number(e.id),
    datumZalozeniUdalosti: String(e.datumZalozeniUdalosti ?? ""),
    datumZverejneniUdalosti: String(e.datumZverejneniUdalosti ?? ""),
    dokumentUrl: String(e.dokumentUrl ?? ""),
    spisovaZnacka: String(e.spisovaZnacka ?? ""),
    typUdalosti: String(e.typUdalosti ?? ""),
    popisUdalosti: String(e.popisUdalosti ?? ""),
    oddil: String(e.oddil ?? ""),
    cisloVOddilu: Number(e.cisloVOddilu ?? 0),
    poznamka: String(e.poznamka ?? ""),
  }));
}

export async function fetchNewEvents(
  fromId: number,
  maxIds?: number
): Promise<{ events: IsirEventData[]; lastId: number }> {
  const currentMax = await getLastPodnetId();
  if (currentMax <= fromId) {
    return { events: [], lastId: currentMax };
  }

  const events: IsirEventData[] = [];
  const upper = maxIds ? Math.min(currentMax, fromId + maxIds) : currentMax;

  for (let id = fromId + 1; id <= upper; id++) {
    try {
      const data = await getEventData(id);
      events.push(...data);
    } catch (err) {
      console.warn(`[ISIR] Failed to fetch ID ${id}:`, err);
    }
    if (id < upper) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return { events, lastId: upper };
}

export function extractCourtFromSpis(spisovaZnacka: string): string | null {
  const match = spisovaZnacka.match(/^([A-Z]+)/);
  return match ? match[1] : null;
}

export function extractDruhStavRizeni(poznamka: string): string | null {
  const match = poznamka.match(/<druhStavRizeni>([^<]+)<\/druhStavRizeni>/);
  return match ? match[1] : null;
}

export function isSectionRelevant(section: string | null): boolean {
  if (!section) return false;
  const s = section.toUpperCase();
  // Substantive procedural sections: A (úpadek/řízení), B (rozhodnutí),
  // D (zpeněžení majetku). The high-volume P* sections are oddlužení/
  // přihlášky ticker entries that add little signal, so they are excluded.
  return s === "A" || s === "B" || s === "D";
}

export function isApartmentCandidate(event: IsirEventData): boolean {
  const text = `${event.popisUdalosti} ${event.poznamka}`.toLowerCase();

  const APARTMENT_KEYWORDS = [
    "byt",
    "bytov",
    "jednotk",
    "nemovitost",
    "garsoni",
    "apartm",
  ];

  return APARTMENT_KEYWORDS.some((kw) => text.includes(kw));
}

export { REQUEST_DELAY_MS };
