import { fetchBuffer } from "./http";
import { resolveNkodDownloadUrl } from "./nkod";
import { extractZipEntry } from "./czso";
import { cityKeyForMunicipality } from "./czso";

const AGE_DATASET_IRI =
  "https://data.gov.cz/zdroj/datov%C3%A9-sady/00025593/fb8a04fc918293413a8a9f364ad10a24";
const FIRMS_DATASET_IRI =
  "https://data.gov.cz/zdroj/datov%C3%A9-sady/00025593/4156effd80645c4934e66a25f71033f6";

const CP1250 = "windows-1250";

function decodeCp1250(buf: Buffer): string {
  // ČSÚ datasety (SLDB/RES) jsou UTF-8; cp1250 jen jako záchrana
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buf));
  } catch {
    // Není validní UTF-8 → Windows-1250
  }
  try {
    return new TextDecoder(CP1250).decode(new Uint8Array(buf));
  } catch {
    return buf.toString("utf8");
  }
}function splitCsv(line: string): string[] {
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

function clean(v: string): string {
  return v.replace(/"/g, "").trim();
}

/** Z textu "65 a 66 (...)" nebo "Od 100 (...)" vrátí počáteční věk skupiny. */
function ageStart(vekTxt: string): number | null {
  const m = vekTxt.trim().match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (/od\s*100/i.test(vekTxt)) return 100;
  return null;
}

/**
 * Věková struktura (podíl 65+) za správní obvody obcí s rozšířenou působností,
 * SLDB 2021 (ČSÚ). Per ORP → cityKey přes přesnou shodu názvu obce.
 * Vrací mapu cityKey -> { share65plus, population }.
 */
export async function fetchAgeStructure(): Promise<{
  byCity: Record<string, { share65plus: number; population: number }>;
  period: string;
}> {
  const url = await resolveNkodDownloadUrl(AGE_DATASET_IRI);
  const buf = await fetchBuffer(url);
  const text = decodeCp1250(buf);

  // idhod,hodnota,stapro_kod,pohlavi_cis,pohlavi_kod,vek_cis,vek_kod,vuzemi_cis,vuzemi_kod,casref_do,pohlavi_txt,vek_txt,vuzemi_txt
  const byCity: Record<string, { total: number; over65: number }> = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('"idhod"')) continue;
    const parts = splitCsv(line);
    if (parts.length < 13) continue;
    const vuzemi = clean(parts[8]); // vuzemi_kod (ORP)
    if (parts[7] !== "65") continue; // správní obvod ORP
    const name = clean(parts[12]);
    const key = cityKeyForMunicipality(name);
    if (!key) continue;
    const v = parseFloat(clean(parts[1]));
    if (!Number.isFinite(v)) continue;
    const start = ageStart(clean(parts[11]));
    if (start == null) continue;
    if (!byCity[key]) byCity[key] = { total: 0, over65: 0 };
    byCity[key].total += v;
    if (start >= 65) byCity[key].over65 += v;
  }

  const result: Record<string, { share65plus: number; population: number }> = {};
  for (const [key, d] of Object.entries(byCity)) {
    if (d.total <= 0) continue;
    result[key] = {
      share65plus: Math.round((d.over65 / d.total) * 1000) / 10,
      population: Math.round(d.total),
    };
  }
  return { byCity: result, period: "2021" };
}

/**
 * Počet registrovaných ekonomických subjektů se sídlem v obci (ČSÚ RES, Q4 2025).
 * Souhrnný řádek = prázdná forma i aktivita (vuzemi_cis=43, obce).
 * Vrací mapu cityKey -> počet subjektů.
 */
export async function fetchFirmsPerCity(): Promise<{ byCity: Record<string, number>; period: string }> {
  const url = await resolveNkodDownloadUrl(FIRMS_DATASET_IRI);
  const buf = await fetchBuffer(url);
  const text = decodeCp1250(extractZipEntry(buf));

  // idhod,hodnota,stapro_kod,aktivita_cis,aktivita_kod,forma_cis,forma_kod,vuzemi_cis,vuzemi_kod,casref,aktivita_txt,forma_txt,vuzemi_txt
  const byCity: Record<string, number> = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('"idhod"')) continue;
    const parts = splitCsv(line);
    if (parts.length < 13) continue;
    if (parts[2] !== "4958") continue; // počet subjektů
    if (parts[7] !== "43") continue; // obce
    // Souhrn: forma i aktivita prázdné
    if (clean(parts[5]) || clean(parts[3])) continue;
    const name = clean(parts[12]);
    const key = cityKeyForMunicipality(name);
    if (!key) continue;
    const v = parseFloat(clean(parts[1]));
    if (!Number.isFinite(v) || v < 0) continue;
    if (byCity[key] == null) byCity[key] = Math.round(v);
  }
  return { byCity, period: "2025-Q4" };
}
