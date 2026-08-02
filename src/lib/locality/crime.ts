import * as XLSX from "xlsx";
import { fetchBuffer } from "./http";
import { db } from "@/db";
import { localityMetrics } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ts } from "@/lib/utils";

/**
 * Kriminalita z reálných měsíčních statistik PČR (XLSX).
 * Zdroj: https://www.policie.cz/clanek/statisticke-prehledy-kriminality-za-rok-2025.aspx
 * Každý sheet = kraj, souhrnný řádek "CELKOVÁ KRIMINALITA" = počet registrovaných TČ.
 */

const SOURCE_URLS = {
  "2025-12": "https://www.policie.cz/soubor/2025-12-prosinec-sest-01a-xlsx.aspx",
};

/** Sheet název -> regionKey (shodné s CITY_TO_REGION). */
const SHEET_TO_REGION: Record<string, string> = {
  Praha: "praha",
  Středočeský: "stredocesky",
  Jihočeský: "jihocesky",
  Plzeňský: "plzensky",
  Ústecký: "ustecky",
  Královéhradecký: "kralovehradecky",
  Jihomoravský: "jihomoravsky",
  Moravskoslezský: "moravskoslezsky",
  Olomoucký: "olomoucky",
  Zlínský: "zlinsky",
  Vysočina: "vysocina",
  Pardubický: "pardubicky",
  Liberecký: "liberecky",
  Karlovarský: "karlovarsky",
};

/** Počet obyvatel kraje (ČSÚ, ~2024) pro normalizaci indexu na 100k obyvatel. */
export const REGION_POPULATION: Record<string, number> = {
  praha: 1397880,
  stredocesky: 1459392,
  jihocesky: 654766,
  plzensky: 611034,
  ustecky: 812200,
  kralovehradecky: 555890,
  jihomoravsky: 1214881,
  moravskoslezsky: 1183294,
  olomoucky: 640176,
  zlinsky: 580459,
  vysocina: 520076,
  pardubicky: 532555,
  liberecky: 452278,
  karlovarsky: 292566,
};

export interface CrimeRegionData {
  regionKey: string;
  registeredCrimes: number;
  clearedCrimes: number;
  clearRatePct: number;
  crimeIndexPer100k: number;
  period: string;
  source: string;
}

const CACHE_SOURCE = "pcr-crime";

export async function fetchCrimeRegions(): Promise<CrimeRegionData[]> {
  const entries = Object.entries(SOURCE_URLS);
  const period = entries[0][0];
  const url = entries[0][1];
  const buffer = await fetchBuffer(url, 60000);
  const wb = XLSX.read(buffer, { type: "buffer" });

  const results: CrimeRegionData[] = [];
  for (const sheetName of wb.SheetNames) {
    const regionKey = SHEET_TO_REGION[sheetName];
    if (!regionKey) continue;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    const totalRow = rows.find((r) => String(r[0] ?? "").trim() === "0-999" || String(r[1] ?? "").includes("CELKOVÁ KRIMINALITA"));
    if (!totalRow) continue;
    const registered = Number(totalRow[2]) || 0;
    const cleared = Number(totalRow[3]) || 0;
    const clearRatePct = cleared > 0 ? Math.round((cleared / registered) * 1000) / 10 : 0;
    const population = REGION_POPULATION[regionKey] ?? 1;
    const crimeIndexPer100k = Math.round((registered / population) * 100000);
    results.push({
      regionKey,
      registeredCrimes: registered,
      clearedCrimes: cleared,
      clearRatePct,
      crimeIndexPer100k,
      period,
      source: "policie.cz",
    });
  }
  return results;
}

/** Mapování cityKey -> kraj. */
export const CITY_TO_REGION: Record<string, string> = {
  praha: "praha",
  brno: "jihomoravsky",
  plzen: "plzensky",
  ostrava: "moravskoslezsky",
  usti: "ustecky",
  olomouc: "olomoucky",
  hradec: "kralovehradecky",
  pardubice: "pardubicky",
  liberec: "liberecky",
  zlin: "zlinsky",
  karlovy_vary: "karlovarsky",
  jihlava: "vysocina",
  ceske_budejovice: "jihocesky",
};

export async function getCrimeIndexForCity(cityKey: string): Promise<{
  crimeIndexPer100k: number | null;
  clearRatePct: number | null;
  period: string | null;
}> {
  const regionKey = CITY_TO_REGION[cityKey];
  if (!regionKey) return { crimeIndexPer100k: null, clearRatePct: null, period: null };

  // Cache v locality_metrics (source=pcr-crime)
  const now = Date.now();
  const TTL_MS = 30 * 24 * 60 * 60 * 1000; // měsíční data, 30 dní TTL
  const cached = await db
    .select({ jsonData: localityMetrics.jsonData, fetchedAt: localityMetrics.fetchedAt })
    .from(localityMetrics)
    .where(and(eq(localityMetrics.cityKey, cityKey), eq(localityMetrics.source, CACHE_SOURCE), eq(localityMetrics.period, "latest")))
    .limit(1)
    .then((r) => r[0]);

  if (cached && now - Number(cached.fetchedAt) < TTL_MS) {
    try {
      const d = JSON.parse(cached.jsonData) as CrimeRegionData;
      return {
        crimeIndexPer100k: d.crimeIndexPer100k ?? null,
        clearRatePct: d.clearRatePct ?? null,
        period: d.period ?? null,
      };
    } catch {
      // fall through
    }
  }

  try {
    const regions = await fetchCrimeRegions();
    const region = regions.find((r) => r.regionKey === regionKey);
    if (region) {
      await db
        .insert(localityMetrics)
        .values({ cityKey, source: CACHE_SOURCE, period: "latest", jsonData: JSON.stringify(region), fetchedAt: ts() })
        .onConflictDoUpdate({
          target: [localityMetrics.cityKey, localityMetrics.source, localityMetrics.period],
          set: { jsonData: JSON.stringify(region), fetchedAt: ts() },
        });
      return {
        crimeIndexPer100k: region.crimeIndexPer100k,
        clearRatePct: region.clearRatePct,
        period: region.period,
      };
    }
  } catch (e) {
    console.error("Crime fetch failed:", e);
  }

  // Žádný vymyšlený fallback — vrátíme null
  return { crimeIndexPer100k: null, clearRatePct: null, period: null };
}
