import { cityNamesFor } from "@/lib/analysis/location";

export interface GeocodeResult {
  lat: number | null;
  lng: number | null;
  displayName: string | null;
  source: "address" | "city" | null;
}

export interface ReverseGeocodeResult {
  suburb: string | null;
  city: string | null;
  displayName: string | null;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&accept-language=cs&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "RealFlip/1.0 (real estate investment analysis; contact: info@realflip.cz)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = data[0];
  if (!first) return null;
  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: first.display_name ?? null };
}

/**
 * Převod cityKey na lidský název města pro geokódování.
 * Používá cityNamesFor z location.ts (aliasy: "plzen" -> "Plzeň", "praha" -> "Praha").
 */
export function cityKeyToName(cityKey: string | null | undefined): string | null {
  if (!cityKey || cityKey === "Neznámá" || cityKey === "unknown") return null;
  const names = cityNamesFor(cityKey);
  // Preferovat název s diakritikou (má háčky/čárky) a bez podtržítek
  const pretty =
    names.find((n) => /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(n) && !n.includes("_")) ??
    names.find((n) => n.includes(" ") && !n.includes("_")) ??
    names[0];
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : null;
}

/**
 * Geokódování adresy přes OSM Nominatim.
 * 1. Pokus: adresa + název města (přesnější, řeší běžné názvy ulic).
 * 2. Fallback: jen název města (centrum).
 * 3. Fallback: null (adresa se zobrazí jen jako text).
 */
export async function geocodeAddress(
  address: string | null | undefined,
  cityKey: string | null | undefined
): Promise<GeocodeResult> {
  const cityName = cityKeyToName(cityKey);
  const addr = address?.trim();

  if (addr && cityName) {
    try {
      const result = await nominatimSearch(`${addr}, ${cityName}`);
      if (result) return { ...result, source: "address" };
    } catch {
      // fall through
    }
  }

  if (addr) {
    try {
      const result = await nominatimSearch(addr);
      if (result) return { ...result, source: "address" };
    } catch {
      // fall through
    }
  }

  if (cityName) {
    try {
      const result = await nominatimSearch(cityName);
      if (result) return { ...result, source: "city" };
    } catch {
      // fall through
    }
  }

  return { lat: null, lng: null, displayName: null, source: null };
}

/**
 * Reverse-geokódování GPS → název městské části (suburb/quarter) a města.
 * Používá se pro fallback POI u nemovitostí mimo sreality.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=cs&zoom=14`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "RealFlip/1.0 (real estate investment analysis; contact: info@realflip.cz)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { suburb: null, city: null, displayName: null };
    const data = (await res.json()) as {
      address?: { suburb?: string; city?: string; town?: string; village?: string };
      display_name?: string;
    };
    return {
      suburb: data.address?.suburb ?? null,
      city: data.address?.city ?? data.address?.town ?? data.address?.village ?? null,
      displayName: data.display_name ?? null,
    };
  } catch {
    return { suburb: null, city: null, displayName: null };
  }
}
