import { cityNamesFor } from "@/lib/analysis/location";
import { RateLimiter } from "@/lib/scraping/rate-limiter";

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
  /** Čtvrť extrahovaná z display_name ("Praha 3", "Plzeň 2-Slovany") — přesnější než suburb. */
  quarter: string | null;
}

/** Návrh adresy z autocomplete (Nominatim search). */
export interface AddressSuggestion {
  /** Krátký popisek pro dropdown (ulice + město). */
  label: string;
  /** Vyčištěná adresa pro fields.address (obsahuje čtvrť — ward matching). */
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  quarter: string | null;
  suburb: string | null;
  /** Názvy čtvrtí pro ward drill-down (address.quarter + suburb). */
  wardHints: string[];
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const NOMINATIM_HEADERS = {
  "User-Agent": "RealFlip/1.0 (real estate investment analysis; contact: info@realflip.cz)",
  Accept: "application/json",
};

// Autocomplete cache — opakované/stejné dotazy nemusí jít na Nominatim (rate limit 1/s)
const suggestCache = new Map<string, { data: AddressSuggestion[]; at: number }>();
const SUGGEST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Vyčistí autocomplete cache (testy / force refresh). */
export function clearSuggestCache(): void {
  suggestCache.clear();
}

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&accept-language=cs&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: NOMINATIM_HEADERS,
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

interface NominatimSearchItem {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    quarter?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
  };
}

/** Vyčistí adresu z Nominatim address detailů — ulice + č.p., čtvrť, město. */
function cleanAddressFrom(a: NominatimSearchItem["address"]): string {
  if (!a) return "";
  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  const area = a.suburb ?? a.quarter ?? a.neighbourhood ?? "";
  const city = a.city ?? a.town ?? a.village ?? "";
  return [street, area, city].filter(Boolean).join(", ");
}

/**
 * Autocomplete adres (jako Valuo) — Nominatim search s address details.
 * Vrací normalizované návrhy včetně GPS a hintů na čtvrť (quarter/suburb),
 * aby se ward v cenové mapě vždy namatchoval přesně. Cache 6 h + žádný
 * návrat pod 3 znaky. Selhání → prázdný seznam (ruční zadání stále funguje).
 */
export async function suggestAddresses(
  query: string,
  cityKey?: string | null
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const cityName = cityKeyToName(cityKey);
  const cacheKey = `${cityName ?? ""}|${q.toLowerCase()}`;
  const cached = suggestCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SUGGEST_CACHE_TTL_MS) return cached.data;

  // Město z formuláře se přidá k dotazu — návrhy se tím vyfiltrují na vybranou lokalitu
  const fullQuery = cityName ? `${q}, ${cityName}` : q;
  const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=1&countrycodes=cz&limit=6&accept-language=cs&dedupe=1&q=${encodeURIComponent(fullQuery)}`;

  // Nominatim: max ~1 dotaz/s — cache hit se limiteru vyhne, throttling až při reálném fecthu
  const rateLimiter = RateLimiter.getInstance();
  await rateLimiter.wait("nominatim", 1000);

  try {
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const items = (await res.json()) as NominatimSearchItem[];

    const suggestions: AddressSuggestion[] = items
      .map((it) => {
        const lat = parseFloat(it.lat ?? "");
        const lng = parseFloat(it.lon ?? "");
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const a = it.address ?? {};
        const city = a.city ?? a.town ?? a.village ?? "";
        // label = plná vyčištěná adresa (obsahuje čtvrť → ward matching); fallback město/čtvrť
        const label = cleanAddressFrom(a) || (it.display_name ?? "");
        if (!label) return null;
        const quarter = a.quarter ?? null;
        const suburb = a.suburb ?? null;
        return {
          label,
          address: label,
          lat,
          lng,
          city: city || null,
          quarter,
          suburb,
          wardHints: [...new Set([quarter, suburb, a.neighbourhood].filter((x): x is string => Boolean(x)))],
        };
      })
      .filter((s): s is AddressSuggestion => s != null)
      // přesné adresy (ulice/č.p.) před čtvrtěmi/městy — Nominatim řadí sám, tohle je pojistka
      .sort((x, y) => Number(y.label.includes(",")) - Number(x.label.includes(",")));

    suggestCache.set(cacheKey, { data: suggestions, at: Date.now() });
    return suggestions;
  } catch {
    return [];
  }
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
    if (!res.ok) return { suburb: null, city: null, displayName: null, quarter: null };
    const data = (await res.json()) as {
      address?: { suburb?: string; city?: string; town?: string; village?: string };
      display_name?: string;
    };
    const displayName = data.display_name ?? null;
    const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? null;
    // Extrakce čtvrti z display_name: "suburb, ČTVRŤ, Město, okres..." — druhá položka
    // (oddělená čárkou) je obvykle městská část ("Plzeň 3", "Praha 3", "Brno-střed").
    // Fallback: suburb. Vynecháme, pokud by parts[1] bylo jen město ("Vesnička, Liberec").
    let quarter: string | null = null;
    if (displayName) {
      const parts = displayName.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const candidate = parts[1];
        const cityLower = city?.toLowerCase();
        if (
          candidate &&
          candidate.toLowerCase() !== cityLower &&
          /^(praha|brno|plzeň|plzen|ostrava|olomouc|ústí|usti|liberec|pardubice|hradec|zlín|zlin|karlovy|cheb|české|ceske)(?:\s|$)/i.test(candidate)
        ) {
          quarter = candidate;
        }
      }
    }
    return {
      suburb: data.address?.suburb ?? null,
      city,
      displayName,
      quarter: quarter ?? data.address?.suburb ?? null,
    };
  } catch {
    return { suburb: null, city: null, displayName: null, quarter: null };
  }
}
