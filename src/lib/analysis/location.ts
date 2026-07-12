import { LocationResult, LocationCategory } from "./types";
import { MARKET_DATA, RISKY_CITIES } from "./market-data";

const CITY_ALIASES: Record<string, string> = {
  "české budějovice": "ceske_budejovice",
  "cb": "ceske_budejovice",
  "budejovice": "ceske_budejovice",
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
  "kladno": "kladno",
  "mladá boleslav": "mlada_boleslav",
  "mlada boleslav": "mlada_boleslav",
  "kolín": "kolin",
  "kolin": "kolin",
  "jihlava": "jihlava",
  "karvina": "karvina",
  "karviná": "karvina",
  "trutnov": "trutnov",
  "písek": "pisek",
  "pisek": "pisek",
  "tábor": "tabor",
  "tabor": "tabor",
  "chomutov": "chomutov",
  "děčín": "decin",
  "decin": "decin",
  "teplice": "teplice",
  "cheb": "cheb",
  "příbram": "pribram",
  "pribram": "pribram",
  "prostějov": "prostejov",
  "prostejov": "prostejov",
  "přerov": "prerov",
  "prerov": "prerov",
  "havlíčkův brod": "havlickuv_brod",
  "znojmo": "znojmo",
  "česká lípa": "ceska_lipa",
  "ceska lipa": "ceska_lipa",
  "kroměříž": "kromeriz",
  "kromeriz": "kromeriz",
  "bruntál": "bruntal",
  "jeseník": "jesenik",
  "jesenik": "jesenik",
  "havířov": "havirov",
  "havirov": "havirov",
  "třebíč": "trebic",
  "trebic": "trebic",
  "benesov": "benesov",
  "benešov": "benesov",
  "letohrad": "letohrad",
  "most": "most",
  "opava": "opava",
  "třinec": "trinec",
  "trinec": "trinec",
  "nýrsko": "nyrsko",
  "nyrsko": "nyrsko",
  "třemošná": "tremosna",
  "tremosna": "tremosna",
  "jarov": "jarov",
  "kramolín": "kramolin",
  "kramolin": "kramolin",
  "černčice": "cerncice",
  "cerncice": "cerncice",
  "hoštka": "hostka",
  "hostka": "hostka",
  "rašín": "rasin",
  "rasin": "rasin",
  "vráž": "vraz",
  "vraz": "vraz",
  "horšovský týn": "horsovsky_tyn",
  "horsovsky tyn": "horsovsky_tyn",
  "smržov": "smrzov",
  "smrzov": "smrzov",
  "břeclav": "breclav",
  "breclav": "breclav",
  "polná": "polna",
  "polna": "polna",
  "beroun": "beroun",
  "mělník": "melnik",
  "melnik": "melnik",
  "žacléř": "zacler",
  "zacler": "zacler",
  "prachatice": "prachatice",
  "český brod": "cesky_brod",
  "cesky brod": "cesky_brod",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–\-—]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
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
