import { fetchText } from "./http";
import { PoiCounts } from "./types";
import { scoreWalkability } from "./score";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const QUERY = `
[out:json][timeout:25];
(
  node["amenity"="school"](around:1000,{LAT},{LNG});
  node["amenity"="kindergarten"](around:1000,{LAT},{LNG});
  node["highway"="bus_stop"](around:1000,{LAT},{LNG});
  node["railway"="station"](around:2000,{LAT},{LNG});
  node["railway"="halt"](around:2000,{LAT},{LNG});
  node["amenity"="pharmacy"](around:1000,{LAT},{LNG});
  node["amenity"="hospital"](around:2000,{LAT},{LNG});
  node["amenity"="clinic"](around:1500,{LAT},{LNG});
  node["shop"~"supermarket|convenience"](around:1000,{LAT},{LNG});
  node["amenity"="restaurant"](around:1000,{LAT},{LNG});
  node["leisure"="fitness_centre"](around:1000,{LAT},{LNG});
  node["leisure"="sports_centre"](around:1000,{LAT},{LNG});
  node["leisure"="park"](around:1500,{LAT},{LNG});
  node["leisure"="garden"](around:1500,{LAT},{LNG});
  node["amenity"="bank"](around:1000,{LAT},{LNG});
  node["amenity"="atm"](around:1000,{LAT},{LNG});
);
out tags;
`;

export interface PoiResult {
  counts: PoiCounts;
  walkability: number;
}

export async function fetchPoi(lat: number, lng: number): Promise<PoiResult> {
  const query = QUERY.replace("{LAT}", lat.toString()).replace("{LNG}", lng.toString());

  let lastErr: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RealFlip/1.0" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const data = (await res.json()) as { elements?: Array<{ tags?: Record<string, string> }> };
      const counts = countPoi(data.elements ?? []);
      return { counts, walkability: scoreWalkability(counts) };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error("Overpass unavailable");
}

function countPoi(elements: Array<{ tags?: Record<string, string> }>): PoiCounts {
  const c: PoiCounts = {
    skoly: 0,
    skolky: 0,
    mhd: 0,
    vlak: 0,
    obchody: 0,
    restaurace: 0,
    zdravotnictvi: 0,
    lekarny: 0,
    sport: 0,
    parky: 0,
    bankomaty: 0,
  };
  for (const el of elements) {
    const t = el.tags ?? {};
    if (t["amenity"] === "school") c.skoly++;
    else if (t["amenity"] === "kindergarten") c.skolky++;
    else if (t["highway"] === "bus_stop") c.mhd++;
    else if (t["railway"] === "station" || t["railway"] === "halt") c.vlak++;
    else if (t["amenity"] === "pharmacy") c.lekarny++;
    else if (t["amenity"] === "hospital" || t["amenity"] === "clinic") c.zdravotnictvi++;
    else if (t["shop"] && /supermarket|convenience/.test(t["shop"])) c.obchody++;
    else if (t["amenity"] === "restaurant") c.restaurace++;
    else if (t["leisure"] === "fitness_centre" || t["leisure"] === "sports_centre") c.sport++;
    else if (t["leisure"] === "park" || t["leisure"] === "garden") c.parky++;
    else if (t["amenity"] === "atm" || t["amenity"] === "bank") c.bankomaty++;
  }
  return c;
}
