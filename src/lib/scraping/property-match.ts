// Cross-portal shoda nemovitostí: stejná nemovitost inzerovaná na více portálech
// (sreality + remax + bazos + annonce...) má jinou URL, a tedy by vznikaly
// duplicitní záznamy. Tento modul poskytuje konzervativní obsahovou shodu
// (adresa + dispozice + plocha) a helpery pro sloupec alt_portals.

import { tokenize, roomsEqual, areasWithin } from "./relisting";

export interface AltPortal {
  portalName: string;
  url: string;
}

export interface MatchableListing {
  portalName: string;
  title: string;
  address: string | null;
  rooms: string | null;
  area: number | null;
  price?: number | null;
}

export interface MatchCandidate {
  id: string;
  portalName: string;
  title: string | null;
  address: string | null;
  rooms: string | null;
  area: number | null;
  price?: number | null;
  lastSeen: number | null;
  isActive: number | null;
}

/** Čísla (popisné/orientační) v adrese — "Zdiměřická 1446 / 1446" → ["1446"]. */
export function houseNumbersOf(address: string | null | undefined): string[] {
  if (!address) return [];
  return address.match(/\d+/g) ?? [];
}

/**
 * Cenová konzistence: obě ceny známé (> 0) → ratio ≤ 1.25. Neznámá cena
 * (0/chybí) → null (nelze posoudit, nezablokuje).
 */
export function pricesConsistent(a: number | null | undefined, b: number | null | undefined): boolean | null {
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  const ratio = Math.max(a, b) / Math.min(a, b);
  return ratio <= 1.25;
}

/**
 * Konzervativní shoda napříč portály — na rozdíl od listingMatches (relisting.ts)
 * NEPOŽADUJE stejný portál a nepoužívá titul jako poslední záchranu (tituly typu
 * „Prodej bytu 3+1 75 m²" jsou napříč portály příliš generické → falešné pozitiva).
 * Požadujeme: adresa (≥ 2 tokeny + dispozice + plocha), nebo 1 specifický token
 * (≥ 4 znaky) + přesná shoda dispozice i plochy.
 */
// Generické místopisné tokeny (bez diakritiky, po normalizeText) — samotné
// nikdy nesmí potvrdit shodu, jinak by se sloučily různé byty ve stejném městě.
const GENERIC_PLACE_TOKENS = new Set([
  // města
  "praha", "brno", "ostrava", "plzen", "olomouc", "liberec", "zlin", "hradec",
  "kralove", "pardubice", "usti", "jihlava", "opava", "kladno", "karlovy",
  "vary", "pisek", "tabor", "mlada", "boleslav", "cheb", "sokolov", "most",
  "decin", "kladno", "karvina", "havirov", "prostejov", "prerov", "chomutov",
  "teplice", "trutnov", "kutna", "horaw", "jindrichuv", "chrudim", "kromeriz",
  "valasske", "mezirici", "frydek", "mistek", "vyskov", "breclav", "hodonin",
  "znojmo", "trebic", "havlickuv", "zatec", "litomerice", "ceska", "lipa",
  "usti", "nad", "labem", "marianske", "lazne", "frantiskovy", "as",
  // části měst / okrsky / kraje
  "hradiste", "uhorske", "lazne", "karlovarsky", "jihocesky", "stredocesky",
  "moravskoslezsky", "zapadocesky", "severocesky", "vysocina", "okr", "okres",
  // obecná místopisná slova
  "cesko", "czech", "czechia", "namesti", "ulice", "stred", "sever", "jih",
  "vychod", "zapad", "kraj", "mesto", "obec", "trida", "hlavni", "prazske",
  "predmesti", "centrum", "stare", "nove", "dolni", "horni",
]);

function isGenericPlace(token: string): boolean {
  return GENERIC_PLACE_TOKENS.has(token);
}

// Názvy obcí/krajů — slouží k ověření, že shoda je ve STEJNÉM městě
// (ulice jako „Edvarda Beneše" existují v mnoha městech → křížová falešná shoda).
const CITY_TOKENS = new Set([
  "praha", "brno", "ostrava", "plzen", "olomouc", "liberec", "zlin", "hradec",
  "kralove", "pardubice", "usti", "jihlava", "opava", "kladno", "karlovy",
  "vary", "pisek", "tabor", "mlada", "boleslav", "cheb", "sokolov", "most",
  "decin", "karvina", "havirov", "prostejov", "prerov", "chomutov",
  "teplice", "trutnov", "kutna", "chrudim", "kromeriz", "valasske",
  "mezirici", "frydek", "mistek", "vyskov", "breclav", "hodonin", "znojmo",
  "trebic", "zatec", "litomerice", "louny", "marianske", "lazne", "as",
  "plzensky", "jihocesky", "stredocesky", "moravskoslezsky", "zapadocesky",
  "severocesky", "kralovehradecky", "pardubicky", "olomoucky", "jihomoravsky",
  "zlinsky", "ustecky", "vysocina", "karlovarsky",
]);


/**
 * Distriktní tokeny z RAW adresy — část za " - " ("Brno - Žebětín" → žebětín).
 * Tokenizer mezeru kolem pomlčky ztratí, proto se čte z původního textu.
 * Distriktní názvy jsou generické (každý byt v Žebětíně ho má v adrese).
 */
function districtTokensOf(rawAddress: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!rawAddress) return out;
  const re = /-\s*([a-záčďéěíňóřšťúůýž0-9]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawAddress))) {
    out.add(m[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  }
  return out;
}

function cityTokensOf(address: string | null | undefined): string[] {
  return tokenize(address).filter((t) => CITY_TOKENS.has(t));
}

/** Města obou adres se musí protínat, pokud jsou u obou známá. */
function sameCityOrUnknown(aA: string | null | undefined, aB: string | null | undefined): boolean {
  const cityA = cityTokensOf(aA);
  const cityB = cityTokensOf(aB);
  if (cityA.length === 0 || cityB.length === 0) return true;
  return cityA.some((c) => cityB.includes(c));
}

/**
 * Společné (významné, nikoli generické místopisné) tokeny adres.
 * Generické (názvy měst, okresů…) se nepočítají — „Karlovy Vary" je v každé
 * adrese a způsoboval by falešné shody všech bytů ve městě.
 */
export function sharedAddressTokens(
  addressA: string | null | undefined,
  addressB: string | null | undefined
): string[] {
  const ca = tokenize(addressA);
  const la = tokenize(addressB);
  const districts = new Set([...districtTokensOf(addressA), ...districtTokensOf(addressB)]);
  return ca.filter(
    (t) => la.includes(t) && !isGenericPlace(t) && !districts.has(t) && t.length >= 4
  );
}

export type MatchStrength = "strong" | "medium" | "weak" | "none";

/** Síla shody napříč portály (konzervativní). */
export function matchStrengthCrossPortal(
  listing: MatchableListing,
  existing: MatchCandidate
): MatchStrength {
  const shared = sharedAddressTokens(listing.address, existing.address);
  const roomsOk = roomsEqual(listing.rooms, existing.rooms);
  const areaOk = areasWithin(listing.area, existing.area);
  const priceOk = pricesConsistent(listing.price, existing.price);

  if (!roomsOk) return "none";

  if (shared.length >= 2) {
    return areaOk !== false && sameCityOrUnknown(listing.address, existing.address)
      ? "strong"
      : "none";
  }

  if (shared.length === 1) {
    if (!sameCityOrUnknown(listing.address, existing.address)) return "none";
    const numsA = houseNumbersOf(listing.address);
    const numsB = houseNumbersOf(existing.address);
    if (numsA.length > 0 && numsB.length > 0) {
      const numbersMatch = numsA.some((n) => numsB.includes(n));
      return numbersMatch && areaOk === true && priceOk !== false ? "medium" : "none";
    }
    // Bez čísla popisného nelze odlišit jednotky v jednom domě — jen weak.
    return areaOk === true && priceOk !== false ? "weak" : "none";
  }

  return "none";
}

/** Shoda použitelná pro automatické sloučení (strong/medium, ne weak). */
export function isAutoMergeMatch(result: MatchStrength): boolean {
  return result === "strong" || result === "medium";
}

/** Boolean varianta — shoda existuje (strong, medium i weak). */
export function listingMatchesCrossPortal(listing: MatchableListing, existing: MatchCandidate): boolean {
  return matchStrengthCrossPortal(listing, existing) !== "none";
}

/** Vybere nejlepšího kandidáta: aktivní před neaktivním, pak nejnovější lastSeen. */
export function bestMatchCandidate(
  listing: MatchableListing,
  candidates: MatchCandidate[]
): MatchCandidate | null {
  let best: MatchCandidate | null = null;
  for (const candidate of candidates) {
    if (!listingMatchesCrossPortal(listing, candidate)) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    const aScore = (best.isActive === 1 ? 1 : 0) * 1000 + (best.lastSeen ?? 0);
    const bScore = (candidate.isActive === 1 ? 1 : 0) * 1000 + (candidate.lastSeen ?? 0);
    if (bScore > aScore) best = candidate;
  }
  return best;
}

const EMPTY: AltPortal[] = [];

/** Načte alt_portals z řádku (SQLite: text JSON · Neon: jsonb pole). */
export function parseAltPortals(raw: unknown): AltPortal[] {
  if (raw == null) return EMPTY;
  if (Array.isArray(raw)) return raw as AltPortal[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AltPortal[]) : EMPTY;
    } catch {
      return EMPTY;
    }
  }
  return EMPTY;
}

/** Přidá {portalName, url} bez duplicit podle url. */
export function appendAltPortal(current: AltPortal[], portalName: string, url: string): AltPortal[] {
  if (current.some((p) => p.url === url)) return current;
  return [...current, { portalName, url }];
}

/** Má záznam v alt_portals danou URL? */
export function hasAltUrl(raw: unknown, url: string): boolean {
  return parseAltPortals(raw).some((p) => p.url === url);
}

/** Seznam sekundárních URL z alt_portals. */
export function altUrlsOf(raw: unknown): string[] {
  return parseAltPortals(raw).map((p) => p.url);
}

/** Serializace pro zápis — JSON string funguje pro SQLite (text) i Neon (jsonb). */
export function toDbAltPortals(value: AltPortal[]): string {
  return JSON.stringify(value);
}