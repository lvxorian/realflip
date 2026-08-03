import { fetchBuffer } from "./http";
import { resolveNkodDownloadUrl } from "./nkod";
import { findCityKey, cityNamesFor } from "@/lib/analysis/location";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–\-—]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mapuje název obce ČSÚ na cityKey POUZE při přesné shodě (normalizovaně).
 * `findCityKey` používá substring matching ("plzenec".includes("plzen")),
 * což by chybně mapovalo "Starý Plzenec", "Plzeň-město" apod.
 */
export function cityKeyForMunicipality(name: string): string | null {
  const n = normalize(name);
  if (!n) return null;
  const direct = findCityKey(n);
  if (!direct) return null;
  for (const cityName of cityNamesFor(direct)) {
    if (normalize(cityName) === n) return direct;
  }
  return null;
}

interface CzsoRow {
  vuk: string;
  vuk_text: string;
  obdobi: string;
  uzemi_cis: string;
  uzemi_kod: string;
  uzemi_txt: string;
  hodnota: string;
}

/**
 * Rozbalí první CSV soubor ze ZIP bufferu.
 * Parsuje centrální adresář (EOCD) — funguje i pro ZIPy s data descriptors
 * (flags 0x08), kde lokální hlavička nemá compSize (ČSÚ RES zips).
 */
export function extractZipEntry(buffer: Buffer): Buffer {
  const { inflateRawSync } = require("zlib");

  // Najdi EOCD (signature 0x06054b50) — hledáme od konce
  let eocd = -1;
  const maxComment = Math.min(buffer.length, 65557);
  for (let i = buffer.length - 22; i >= buffer.length - maxComment - 22 && i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("ZIP: EOCD not found");

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);

  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break; // central dir header
    const method = buffer.readUInt16LE(pos + 10);
    const compSize = buffer.readUInt32LE(pos + 20);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString("utf8", pos + 46, pos + 46 + nameLen);

    if (name.toLowerCase().endsWith(".csv")) {
      // Lokální hlavička na localOffset: 30B + nameLen + extraLen
      const localNameLen = buffer.readUInt16LE(localOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      if (method === 8) return inflateRawSync(buffer.subarray(dataStart, dataStart + compSize));
      if (method === 0) return buffer.subarray(dataStart, dataStart + compSize);
    }

    pos += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("ZIP: no CSV entry found");
}

export function parseCsv(buf: Buffer): CzsoRow[] {
  const text = decodeWindows1250(buf);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.startsWith('"idhod"'));
  const rows: CzsoRow[] = [];
  for (const line of lines) {
    const parts = splitCsv(line);
    if (parts.length < 10) continue;
    rows.push({
      vuk: parts[2].replace(/"/g, ""),
      vuk_text: parts[3].replace(/"/g, ""),
      obdobi: parts[4].replace(/"/g, ""),
      uzemi_cis: parts[7].replace(/"/g, ""),
      uzemi_kod: parts[8].replace(/"/g, ""),
      uzemi_txt: parts[9].replace(/"/g, ""),
      hodnota: parts[1].replace(/"/g, ""),
    });
  }
  return rows;
}

function decodeWindows1250(buf: Buffer): string {
  return buf.toString("utf8");
}

function splitCsv(line: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

/**
 * Nezaměstnanost podle obcí (ČSÚ): vrátí mapu cityKey -> podíl nezaměstnaných (%).
 * Vezme NEZ0004 (podíl nezaměstnaných osob %) pro uzemi_cis=43 (obce), poslední dostupné období.
 */
export async function fetchUnemployment(): Promise<{ byCity: Record<string, number>; period: string }> {
  // Rok 2023 dataset (novější dostupný v NKOD; ČSÚ zveřejňuje s časovým odstupem)
  const datasetIri =
    "https://data.gov.cz/zdroj/datov%C3%A9-sady/00025593/b5c4d539f03a208340bb4479a4647bea";
  const zipUrl = await resolveNkodDownloadUrl(datasetIri);
  const buffer = await fetchBuffer(zipUrl);
  const rows = parseCsv(extractZipEntry(buffer));

  const filter = rows.filter((r) => r.vuk === "NEZ0004" && r.uzemi_cis === "43");
  const latest = new Set(filter.map((r) => r.obdobi));
  const maxPeriod = [...latest].sort().pop() ?? "";

  const byCity: Record<string, number> = {};
  for (const r of filter) {
    if (r.obdobi !== maxPeriod) continue;
    const key = cityKeyForMunicipality(r.uzemi_txt);
    if (!key) continue;
    const v = parseFloat(r.hodnota);
    if (!Number.isFinite(v)) continue;
    if (byCity[key] == null) byCity[key] = v;
  }
  return { byCity, period: maxPeriod };
}

/**
 * Pohyb obyvatel podle obcí (ČSÚ): vrátí mapu cityKey -> { migraceNet, obyvatel, celkovyPrirustek }.
 * Použije DEM0001 (migrační saldo) a DEM0026B (počet obyvatel k 31.12.) pro rok YYYY.
 */
export async function fetchMigration(): Promise<{
  byCity: Record<string, { migraceNet: number; obyvatel: number; celkovyPrirustek: number }>;
  period: string;
}> {
  const datasetIri =
    "https://data.gov.cz/zdroj/datov%C3%A9-sady/00025593/14053173c3ef0b267762217ea8dc9d1a";
  const url = await resolveNkodDownloadUrl(datasetIri);
  const buffer = await fetchBuffer(url);
  const text = decodeWindows1250(buffer);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.startsWith('"idhod"'));
  const rows: CzsoRow[] = [];
  for (const line of lines) {
    const parts = splitCsv(line);
    if (parts.length < 11) continue;
    rows.push({
      vuk: parts[2].replace(/"/g, ""),
      vuk_text: parts[3].replace(/"/g, ""),
      obdobi: parts[8].replace(/"/g, ""),
      uzemi_cis: parts[5].replace(/"/g, ""),
      uzemi_kod: parts[6].replace(/"/g, ""),
      uzemi_txt: parts[10].replace(/"/g, ""),
      hodnota: parts[1].replace(/"/g, ""),
    });
  }

  const byCity: Record<string, { migraceNet: number; obyvatel: number; celkovyPrirustek: number }> = {};
  for (const r of rows) {
    if (r.uzemi_cis !== "43") continue;
    const key = cityKeyForMunicipality(r.uzemi_txt);
    if (!key) continue;
    const v = parseFloat(r.hodnota);
    if (!Number.isFinite(v)) continue;
    if (!byCity[key]) byCity[key] = { migraceNet: 0, obyvatel: 0, celkovyPrirustek: 0 };
    if (r.vuk === "DEM0001") byCity[key].migraceNet = v;
    else if (r.vuk === "DEM0026B") {
      // Největší obec s daným názvem = skutečné město (vyhýbá se částem "Kladno" vs město)
      byCity[key].obyvatel = Math.max(byCity[key].obyvatel, v);
    } else if (r.vuk === "DEM0012") byCity[key].celkovyPrirustek = v;
  }

  const periods = new Set(rows.filter((r) => r.uzemi_cis === "43").map((r) => r.obdobi));
  const period = [...periods].sort().pop() ?? "";
  return { byCity, period };
}
