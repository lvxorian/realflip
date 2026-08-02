/**
 * Fetch detailu sreality inzerátu podle hash_id z URL.
 * Vrací přesné GPS ulice a ID městské části (quarter) — základ pro POI per čtvrť.
 */

const BASE_API = "https://www.sreality.cz/api/v1/estates";

const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.sreality.cz/",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

export interface SrealityDetail {
  hashId: string;
  lat: number | null;
  lng: number | null;
  quarterId: number | null;
  quarterName: string | null;
  districtId: number | null;
  citypart: string | null;
}

/** Extrahuje hash_id z sreality URL (poslední číselný segment). */
export function extractSrealityHashId(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/sreality\.cz/i.test(url)) return null;
  const parts = url.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return last && /^\d+$/.test(last) ? last : null;
}

/** Fetch detailu sreality inzerátu. Vrací null při chybě/404. */
export async function getSrealityDetail(hashId: string): Promise<SrealityDetail | null> {
  try {
    const res = await fetch(`${BASE_API}/${hashId}`, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.result?.locality;
    if (!loc) return null;

    return {
      hashId,
      lat: loc.gps_lat ?? null,
      lng: loc.gps_lon ?? null,
      quarterId: loc.quarter_id ?? null,
      quarterName: loc.quarter ?? null,
      districtId: loc.district_id ?? null,
      citypart: loc.citypart ?? null,
    };
  } catch {
    return null;
  }
}

/** Získá detail pro sreality URL (nebo null, pokud to není sreality URL). */
export async function getSrealityDetailFromUrl(url: string | null | undefined): Promise<SrealityDetail | null> {
  const hashId = extractSrealityHashId(url);
  if (!hashId) return null;
  return getSrealityDetail(hashId);
}
