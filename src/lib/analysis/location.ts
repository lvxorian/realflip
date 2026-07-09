import { LocationResult, LocationCategory } from "./types";
import { MARKET_DATA, RISKY_CITIES } from "./market-data";

const CITY_ALIASES: Record<string, string> = {
  "české budějovice": "ceske_budejovice",
  "český krumlov": "cesky_krumlov",
  "mariánské lázně": "mariansk_lazne",
  "karlovy vary": "karlovy_vary",
  "hradec králové": "hradec",
  "ústí nad labem": "usti",
  "usti nad labem": "usti",
  "praha": "praha",
  "brno": "brno",
  "plzeň": "plzen",
  "plzen": "plzen",
  "ostrava": "ostrava",
  "olomouc": "olomouc",
  "pardubice": "pardubice",
  "liberec": "liberec",
  "zlin": "zlin",
  "zlín": "zlin",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–\-—]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCity(text: string): string | null {
  const n = normalize(text);
  const known = Object.keys(CITY_ALIASES);
  for (const alias of known) {
    if (n.includes(alias)) return CITY_ALIASES[alias];
  }
  return null;
}

function extractDistrict(
  text: string,
  cityKey: string
): { name: string; category: LocationCategory } | null {
  const cityData = MARKET_DATA[cityKey];
  if (!cityData) return null;

  const n = normalize(text);
  const all = [
    ...cityData.districts.premium.map((d) => ({ name: d, category: "premium" as LocationCategory })),
    ...cityData.districts.stable.map((d) => ({ name: d, category: "stable" as LocationCategory })),
    ...cityData.districts.risky.map((d) => ({ name: d, category: "risky" as LocationCategory })),
  ];

  for (const d of all) {
    if (n.includes(normalize(d.name))) return d;
  }
  return null;
}

export function classifyLocation(address: string | null, title: string | null): LocationResult {
  const text = [address, title].filter(Boolean).join(" ");
  if (!text) {
    return { city: "Neznámá", district: null, category: "unknown", segments: null };
  }

  const cityKey = extractCity(text);
  if (!cityKey) {
    return { city: "Neznámá", district: null, category: "unknown", segments: null };
  }

  const cityData = MARKET_DATA[cityKey];

  if (RISKY_CITIES.some((c) => normalize(c) === cityKey)) {
    return {
      city: cityKey,
      district: null,
      category: "risky",
      segments: cityData?.segments ?? null,
    };
  }

  const district = extractDistrict(text, cityKey);
  if (district) {
    return {
      city: cityKey,
      district: district.name,
      category: district.category,
      segments: cityData?.segments ?? null,
    };
  }

  return {
    city: cityKey,
    district: null,
    category: "stable",
    segments: cityData?.segments ?? null,
  };
}
