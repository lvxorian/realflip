/**
 * Radar — makroekonomické série (ČNB repo sazba, ČBA hypoteční sazba/objem,
 * CPI meziroční inflace). ČBA zdroj = cbamonitor.cz (hypomonitor.cbamortgage.cz
 * byl zrušen), data v HTML jako blade_graphData.
 */

import { czDecimal, dateToPeriod, extractBladeGraphData, bladeSeriesToPoints } from "./radar-shared";
import { upsertRadarSeries, type SeriesPoint } from "./radar-store";

const CNB_TXT_URL = "https://www.cnb.cz/cs/casto-kladene-dotazy/.galleries/vyvoj_repo_historie.txt";

const CBA_MORTGAGE_RATE_URL =
  "https://www.cbamonitor.cz/statistika/prumerna-urokova-sazba-novych-hypotek";
const CBA_MORTGAGE_VOLUME_URL =
  "https://www.cbamonitor.cz/statistika/pocet-objem-nove-poskytnutych-hypotek";
const CBA_INFLATION_URL = "https://www.cbamonitor.cz/statistika/mesicni-vyvoj-inflace";

const HEADERS = { "User-Agent": "RealFlip/1.0 (radar data pump)" };

/** Fetch s jedním retry a timeoutem (vzor price-map.ts). */
async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await globalThis.fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${url}: fetch selhal`);
}

// ---------- ČNB repo sazba ----------

/** Historie repo sazeb: [{ date: "YYYY-MM-DD", rate }] od 1995-12. */
export async function fetchCnbRepoRates(): Promise<{ date: string; rate: number }[]> {
  const res = await fetchWithRetry(CNB_TXT_URL);
  const text = await res.text();
  const out: { date: string; rate: number }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\d{4})(\d{2})(\d{2})\|([\d,]+)$/.exec(line.trim());
    if (!m) continue;
    const rate = czDecimal(m[4]);
    if (!Number.isFinite(rate)) continue;
    out.push({ date: `${m[1]}-${m[2]}-${m[3]}`, rate });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Měsíční řada repo sazby — forward-fill: sazba platná k poslednímu dni měsíce. */
export function cnbRepoToMonthly(rates: { date: string; rate: number }[]): SeriesPoint[] {
  if (rates.length === 0) return [];
  const out: SeriesPoint[] = [];
  let idx = 0;
  // první měsíc podle první platné sazby
  const start = new Date(rates[0].date);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const today = new Date();
  while (cur <= today) {
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59);
    while (idx < rates.length - 1 && rates[idx + 1].date <= end.toISOString().slice(0, 10)) idx++;
    if (rates[idx].date <= end.toISOString().slice(0, 10)) {
      out.push([dateToPeriod(cur), rates[idx].rate]);
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

// ---------- ČBA (cbamonitor.cz) ----------

/** Stáhne HTML stránky a vrátí hlavní sérii (graph_data[0]) jako body. */
async function fetchCbaSeries(url: string): Promise<SeriesPoint[] | null> {
  const res = await fetchWithRetry(url);
  const html = await res.text();
  const series = extractBladeGraphData(html);
  if (!series || series.length === 0) return null;
  return bladeSeriesToPoints(series[0]);
}

/** Hypomonitor ČBA — průměrná úroková sazba nových hypoték (měsíčně, %). */
export async function fetchCbaMortgageRate(): Promise<SeriesPoint[] | null> {
  return fetchCbaSeries(CBA_MORTGAGE_RATE_URL);
}

/** Objem nových hypoték bez refinancování (mld Kč, měsíčně). */
export async function fetchCbaMortgageVolume(): Promise<SeriesPoint[] | null> {
  return fetchCbaSeries(CBA_MORTGAGE_VOLUME_URL);
}

/** Meziroční CPI celkem (%, měsíčně, od 1996-01). */
export async function fetchCbaInflation(): Promise<SeriesPoint[] | null> {
  return fetchCbaSeries(CBA_INFLATION_URL);
}

// ---------- Orchestrace ----------

/** Stáhne a uloží všechny makro série (regionKey "cr"). */
export async function refreshMacroSeries(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const [repo, rate, volume, cpi] = await Promise.all([
    fetchCnbRepoRates().then(cnbRepoToMonthly).catch((e) => {
      console.error("Radar: ČNB repo selhal:", e);
      return [] as SeriesPoint[];
    }),
    fetchCbaMortgageRate().catch((e) => {
      console.error("Radar: ČBA sazba selhala:", e);
      return null;
    }),
    fetchCbaMortgageVolume().catch((e) => {
      console.error("Radar: ČBA objem selhal:", e);
      return null;
    }),
    fetchCbaInflation().catch((e) => {
      console.error("Radar: ČBA inflace selhala:", e);
      return null;
    }),
  ]);

  if (repo.length > 0) result.repo_rate = await upsertRadarSeries("repo_rate", "cr", repo);
  if (rate && rate.length > 0) result.cba_mortgage_rate = await upsertRadarSeries("cba_mortgage_rate", "cr", rate);
  if (volume && volume.length > 0) result.cba_mortgage_volume = await upsertRadarSeries("cba_mortgage_volume", "cr", volume);
  if (cpi && cpi.length > 0) result.cpi_yoy = await upsertRadarSeries("cpi_yoy", "cr", cpi);
  return result;
}