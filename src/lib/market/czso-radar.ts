/**
 * Radar — ČSÚ série (DataStat opendata CSV, windows-1250):
 *  - started_flats: zahájené byty per kraj (STA09B kumulace 2006–2025 + STA09A1 2026+)
 *  - avg_wage: průměrná hrubá mzda (WPRACECRQ: národní ZJIST=0 od 2000, krajské kvartální ZJIST=2 od 2011)
 *  - pop_growth: meziroční přírůstek obyvatel (PORKR01)
 *  - real_wage_yoy: meziroční reálný růst mezd (mzdy − CPI, dopočítává se zde)
 */

import { KRAJ_CODE_TO_KEY, clean, quarterToPeriod, splitCsv } from "./radar-shared";
import { decodeCzText } from "./radar-shared";
import { upsertRadarSeries, type SeriesPoint } from "./radar-store";

const DATASTAT = "https://data.csu.gov.cz/opendata/sady";
const HEADERS = { "User-Agent": "RealFlip/1.0 (radar data pump)" };

const STARTED_INDICATOR = "Zahájené byty";
const WAGE_INDICATOR = "5958P";
const POPULATION_INDICATOR = "2406K";

/** Stáhne CSV ze DataStat opendata (windows-1250 → text). */
async function fetchCsv(sada: string): Promise<string> {
  const res = await globalThis.fetch(`${DATASTAT}/${sada}/distribuce/csv`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`DataStat ${sada}: HTTP ${res.status}`);
  return decodeCzText(Buffer.from(await res.arrayBuffer()));
}

/** CSV → řádky polí (řádek 0 = hlavička). */
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => splitCsv(l).map(clean));
}

/** Sloupec podle jména v hlavičce. */
function colIndex(header: string[], name: string): number {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`DataStat: chybí sloupec ${name}`);
  return i;
}

// ---------- Zahájené byty ----------

/**
 * Měsíční počet zahájených bytů per kraj: STA09B (2006-01..2025-12, kumulace →
 * delta) + STA09A1 (2026+, přímé hodnoty). Národní = součet krajů.
 */
export async function fetchStartedFlats(): Promise<Record<string, SeriesPoint[]>> {
  const byRegion = new Map<string, Map<string, number>>();

  // STA09B — kumulované hodnoty
  const bText = await fetchCsv("STA09B");
  const bLines = parseCsv(bText);
  const bHeader = bLines[0];
  const iUkazatel = colIndex(bHeader, "Ukazatel");
  const iPeriod = colIndex(bHeader, "CASKMR");
  const iRegion = colIndex(bHeader, "Uz2");
  const iValue = colIndex(bHeader, "Hodnota");
  const cum = new Map<string, Map<string, number>>();
  for (let r = 1; r < bLines.length; r++) {
    const row = bLines[r];
    if (row[iUkazatel] !== STARTED_INDICATOR || row.length <= iValue) continue;
    const period = row[iPeriod].slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) continue;
    const code = row[iRegion];
    const value = parseFloat(row[iValue]);
    if (!Number.isFinite(value)) continue;
    if (!cum.has(code)) cum.set(code, new Map());
    cum.get(code)!.set(period, value);
  }
  for (const [code, months] of cum) {
    const regionKey = KRAJ_CODE_TO_KEY[code];
    if (!regionKey) continue;
    const sorted = [...months.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    let prev = 0;
    for (const [period, v] of sorted) {
      const delta = Math.round(v - prev);
      if (!byRegion.has(regionKey)) byRegion.set(regionKey, new Map());
      byRegion.get(regionKey)!.set(period, delta);
      prev = v;
    }
  }

  // STA09A1 — přímé hodnoty (2026+)
  const aText = await fetchCsv("STA09A1");
  const aLines = parseCsv(aText);
  const aHeader = aLines[0];
  const aiUkazatel = colIndex(aHeader, "Ukazatel");
  const aiPeriod = colIndex(aHeader, "CASRQMX");
  const aiRegion = colIndex(aHeader, "Uz2");
  const aiValue = colIndex(aHeader, "Hodnota");
  for (let r = 1; r < aLines.length; r++) {
    const row = aLines[r];
    if (row[aiUkazatel] !== STARTED_INDICATOR || row.length <= aiValue) continue;
    const period = row[aiPeriod];
    if (!/^\d{4}-\d{2}$/.test(period)) continue;
    const code = row[aiRegion];
    const value = parseFloat(row[aiValue]);
    if (!Number.isFinite(value)) continue;
    const regionKey = KRAJ_CODE_TO_KEY[code];
    if (!regionKey) continue;
    if (!byRegion.has(regionKey)) byRegion.set(regionKey, new Map());
    byRegion.get(regionKey)!.set(period, Math.round(value));
  }

  // národní = součet krajů za měsíc
  const periods = new Set<string>();
  for (const m of byRegion.values()) for (const p of m.keys()) periods.add(p);
  const cr = new Map<string, number>();
  for (const p of periods) {
    let sum = 0;
    let has = false;
    for (const m of byRegion.values()) {
      const v = m.get(p);
      if (v != null) {
        sum += v;
        has = true;
      }
    }
    if (has) cr.set(p, sum);
  }

  const out: Record<string, SeriesPoint[]> = { cr: [...cr.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)) };
  for (const [regionKey, m] of byRegion) {
    out[regionKey] = [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }
  return out;
}

// ---------- Mzdy ----------

/**
 * Mzdy z WPRACECRQ: národní kvartální (ZJIST=0, od 2000) + krajské kvartální
 * (ZJIST=2, pracovištní metoda, od 2011). Perioda = poslední měsíc kvartálu.
 * WPRACECRQ obsahuje i ostatní členění (5958PI index, 5958PRROZ rozdíl) — bereme
 * pouze 5958P; u krajů jen ZJIST=2, u ČR jen ZJIST=0 (ZJIST=2 má stejné hodnoty).
 */
export async function fetchWages(): Promise<Record<string, SeriesPoint[]>> {
  const text = await fetchCsv("WPRACECRQ");
  const lines = parseCsv(text);
  const header = lines[0];
  const iIndicator = colIndex(header, "IndicatorType");
  const iZjust = colIndex(header, "ZJIST");
  const iQuarter = colIndex(header, "CasQ");
  const iUz02 = colIndex(header, "Uz02");
  const iValue = colIndex(header, "Hodnota");
  const out = new Map<string, Map<string, number>>();
  for (let r = 1; r < lines.length; r++) {
    const row = lines[r];
    if (row[iIndicator] !== WAGE_INDICATOR || row.length <= iValue) continue;
    const code = row[iUz02];
    const zjust = row[iZjust];
    let regionKey: string | null = null;
    if (code === "CZ") {
      if (zjust === "0") regionKey = "cr";
    } else if (zjust === "2") {
      regionKey = KRAJ_CODE_TO_KEY[code] ?? null;
    }
    if (!regionKey) continue;
    const period = quarterToPeriod(row[iQuarter]);
    const value = parseFloat(row[iValue]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!out.has(regionKey)) out.set(regionKey, new Map());
    out.get(regionKey)!.set(period, value);
  }
  const result: Record<string, SeriesPoint[]> = {};
  for (const [regionKey, m] of out) {
    result[regionKey] = [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }
  return result;
}

// ---------- Obyvatelstvo ----------

/** Počet obyvatel k 31. 12. per kraj + ČR (PORKR01), absolutně. */
export async function fetchPopulation(): Promise<Record<string, SeriesPoint[]>> {
  const text = await fetchCsv("PORKR01");
  const lines = parseCsv(text);
  const header = lines[0];
  const iIndicator = colIndex(header, "IndicatorType");
  const iSex = colIndex(header, "POHLK");
  const iYear = colIndex(header, "CasR");
  const iRegion = colIndex(header, "Uz02A");
  const iValue = colIndex(header, "Hodnota");
  const out = new Map<string, Map<string, number>>();
  for (let r = 1; r < lines.length; r++) {
    const row = lines[r];
    if (row[iIndicator] !== POPULATION_INDICATOR || row[iSex] !== "0" || row.length <= iValue) continue;
    const code = row[iRegion];
    if (!code) continue;
    const regionKey = code === "CZ" ? "cr" : KRAJ_CODE_TO_KEY[code];
    if (!regionKey) continue;
    const period = `${row[iYear]}-12`;
    const value = parseFloat(row[iValue]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!out.has(regionKey)) out.set(regionKey, new Map());
    out.get(regionKey)!.set(period, value);
  }
  const result: Record<string, SeriesPoint[]> = {};
  for (const [regionKey, m] of out) {
    result[regionKey] = [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }
  return result;
}

/** Meziroční růst v % z absolutní řady. */
function toGrowthPct(abs: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let i = 1; i < abs.length; i++) {
    const prev = abs[i - 1][1];
    if (prev <= 0) continue;
    out.push([abs[i][0], ((abs[i][1] / prev) - 1) * 100]);
  }
  return out;
}

/** Meziroční růst mzdy v % (12 měsíců zpět u kvartálové řady). */
function wageYoY(wages: SeriesPoint[]): SeriesPoint[] {
  const byPeriod = new Map(wages);
  const out: SeriesPoint[] = [];
  for (const [period, value] of wages) {
    const [y, m] = period.split("-").map(Number);
    const prevYear = `${y - 1}-${String(m).padStart(2, "0")}`;
    const prev = byPeriod.get(prevYear);
    if (prev == null || prev <= 0) continue;
    out.push([period, ((value / prev) - 1) * 100]);
  }
  return out;
}

// ---------- Orchestrace ----------

/**
 * Stáhne a uloží ČSÚ série + dopočítá reálné mzdy (real_wage_yoy = nominální
 * růst mezd − CPI). Vyžaduje cpiYoY z macro refreshe (region "cr").
 */
export async function refreshCzsoSeries(cpiYoY: SeriesPoint[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  const [flats, wages, population] = await Promise.all([
    fetchStartedFlats().catch((e) => {
      console.error("Radar: zahájené byty selhaly:", e);
      return {} as Record<string, SeriesPoint[]>;
    }),
    fetchWages().catch((e) => {
      console.error("Radar: mzdy selhaly:", e);
      return {} as Record<string, SeriesPoint[]>;
    }),
    fetchPopulation().catch((e) => {
      console.error("Radar: obyvatelstvo selhalo:", e);
      return {} as Record<string, SeriesPoint[]>;
    }),
  ]);

  // zahájené byty
  let flatsCount = 0;
  for (const [regionKey, points] of Object.entries(flats)) {
    flatsCount += await upsertRadarSeries("started_flats", regionKey, points);
  }
  result.started_flats = flatsCount;

  // mzdy
  let wagesCount = 0;
  for (const [regionKey, points] of Object.entries(wages)) {
    wagesCount += await upsertRadarSeries("avg_wage", regionKey, points);
  }
  result.avg_wage = wagesCount;

  // reálné mzdy (nominální yoy − CPI), dostupné kombinace regionů
  const cpiByPeriod = new Map(cpiYoY);
  let realCount = 0;
  for (const [regionKey, points] of Object.entries(wages)) {
    const yoy = wageYoY(points).filter(([p]) => cpiByPeriod.has(p));
    const real: SeriesPoint[] = yoy.map(([p, v]) => [p, v - (cpiByPeriod.get(p) ?? 0)]);
    realCount += await upsertRadarSeries("real_wage_yoy", regionKey, real);
  }
  result.real_wage_yoy = realCount;

  // přírůstek obyvatel
  let popCount = 0;
  for (const [regionKey, points] of Object.entries(population)) {
    popCount += await upsertRadarSeries("pop_growth", regionKey, toGrowthPct(points));
  }
  result.pop_growth = popCount;

  return result;
}