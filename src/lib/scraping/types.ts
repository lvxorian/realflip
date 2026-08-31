import { z } from "zod";

export const PortalNameSchema = z.enum([
  "sreality",
  "bezrealitky",
  "bazos",
  "annonce",
  "reality-cz",
  "hyperinzerce",
  "hyperreality",
  "remax",
  "century21",
  "idnes-reality",
  "mmreality",
  "realitymat",
  "realitymix",
  "realingo",
]);

export type PortalName = z.infer<typeof PortalNameSchema>;

export interface PortalConfig {
  name: PortalName;
  enabled: boolean;
  baseUrl: string;
  searchPath: string;
  rateLimitMs: number;
  respectRobotsTxt: boolean;
  requiresJs: boolean;
}

export const PORTAL_CONFIGS: Record<PortalName, PortalConfig> = {
  sreality: {
    name: "sreality",
    enabled: true,
    baseUrl: "https://www.sreality.cz",
    searchPath: "/api/v1/estates",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  bezrealitky: {
    name: "bezrealitky",
    enabled: true,
    baseUrl: "https://www.bezrealitky.cz",
    searchPath: "/vyhledat",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: true,
  },
  bazos: {
    name: "bazos",
    enabled: true,
    baseUrl: "https://reality.bazos.cz",
    searchPath: "/",
    rateLimitMs: 1500,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  annonce: {
    name: "annonce",
    enabled: true,
    baseUrl: "https://www.annonce.cz",
    searchPath: "/reality",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  "reality-cz": {
    name: "reality-cz",
    enabled: true,
    baseUrl: "https://www.reality.cz",
    searchPath: "/prodej/byty/Ceska-republika",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  hyperinzerce: {
    name: "hyperinzerce",
    enabled: true,
    baseUrl: "https://byty.hyperinzerce.cz",
    searchPath: "/byty-prodej",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  hyperreality: {
    name: "hyperreality",
    enabled: false,
    baseUrl: "https://www.hyperreality.cz",
    searchPath: "/vyhledavani",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  remax: {
    name: "remax",
    enabled: true,
    baseUrl: "https://www.remax-czech.cz",
    searchPath: "/reality/vyhledavani",
    rateLimitMs: 3000,
    respectRobotsTxt: true,
    requiresJs: true,
  },
  century21: {
    name: "century21",
    enabled: false,
    baseUrl: "https://www.century21.cz",
    searchPath: "/nemovitosti",
    rateLimitMs: 3000,
    respectRobotsTxt: true,
    requiresJs: true,
  },
  "idnes-reality": {
    name: "idnes-reality",
    enabled: true,
    baseUrl: "https://reality.idnes.cz",
    searchPath: "/",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: true,
  },
  mmreality: {
    name: "mmreality",
    enabled: true,
    baseUrl: "https://www.mmreality.cz",
    searchPath: "/nemovitosti",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  realitymat: {
    name: "realitymat",
    enabled: true,
    baseUrl: "https://www.realitymat.cz",
    searchPath: "/nemovitosti",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  realitymix: {
    name: "realitymix",
    enabled: true,
    baseUrl: "https://www.realitymix.cz",
    searchPath: "/reality/byty/prodej",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  realingo: {
    name: "realingo",
    enabled: false,
    baseUrl: "https://www.realingo.cz",
    searchPath: "/graphql",
    rateLimitMs: 500,
    respectRobotsTxt: false,
    requiresJs: false,
  },
};

export interface SearchFilters {
  location?: string;
  district?: string;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  propertyType?: string;
  condition?: string;
  buildingType?: string;
}

export const MIN_REAL_ESTATE_PRICE = 50000;

const PLACEHOLDER_IMAGE_PATTERNS = [
  /nophoto/i, /no-photo/i, /placeholder/i,
  /blank\.(gif|png|jpg)/i, /pixel\.(gif|png|jpg)/i,
  /1x1\.(gif|png|jpg)/i, /transparent/i, /default_img/i,
  /noimage/i, /no-image/i, /image_not_found/i,
  /not-available/i, /not_available/i, /virtual-play/i,
];

const PORTAL_BASE_URLS: Record<string, string> = {
  sreality: "https://www.sreality.cz",
  "reality-cz": "https://www.reality.cz",
  hyperinzerce: "https://byty.hyperinzerce.cz",
  annonce: "https://www.annonce.cz",
  bazos: "https://reality.bazos.cz",
  mmreality: "https://www.mmreality.cz",
  "idnes-reality": "https://reality.idnes.cz",
  realitymat: "https://www.realitymat.cz",
  realitymix: "https://www.realitymix.cz",
  realingo: "https://www.realingo.cz",
};

export function normalizeImageUrl(url: string | null | undefined, portalName?: string): string {
  if (!url || url.length < 5) return "";
  if (url.startsWith("data:image/gif") || url.startsWith("data:image/png;base64")) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/") && portalName) {
    const base = PORTAL_BASE_URLS[portalName];
    if (base) return base + url;
  }
  return "";
}

/**
 * Annonce.cz servíruje stejný obrázek ve více rozlišeních:
 * `.../attachment/{dir}/{id}_{resize}.jpg` = malý náhled (142x106),
 * `.../attachment/{dir}/{id}.jpg` = plné rozlišení (data-full / <a href> v detailu).
 * Pro annonce odstraní query string i `_{N}` příponu, ostatní portály nechá beze změny.
 */
export function toFullSizeImageUrl(url: string, portalName?: string): string {
  if (!url || portalName !== "annonce") return url;
  const clean = url.split("?")[0];
  if (!/^https:\/\/static\.annonce\.cz\/attachment\//.test(clean)) return url;
  return clean.replace(/_\d+\.(jpe?g|png|webp)$/i, ".$1");
}

/**
 * Sreality API vrací popis inzerátu jako HTML (`<br />`, `<p>`, entity…).
 * Tato funkce ho převede na čistý text: `<br>`/odstavce → nové řádky (detail je
 * renderuje přes `whitespace-pre-wrap`), ostatní tagy a HTML entity pryč.
 * Pro portály, které už vracejí text (cheerio .text()), je idempotentní.
 */
export function cleanHtmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Windows CRLF (sreality API vrací \r\n) sjednotíme na \n
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ +/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim() || null;
}

export function filterImages(urls: string[], portalName?: string): string[] {
  const seen = new Set<string>();
  return urls
    .map((url) => normalizeImageUrl(url, portalName))
    .filter((url) => {
      if (!url || url.length < 10) return false;
      if (/^https?:\/\/\//.test(url)) return false;
      if (url.startsWith("data:image/svg+xml")) return false;
      if (PLACEHOLDER_IMAGE_PATTERNS.some((p) => p.test(url))) return false;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

export function isValidPrice(price: number): boolean {
  return price > 0 && price >= MIN_REAL_ESTATE_PRICE;
}

/**
 * Parsování české ceny z textu. Řeší tečku jako oddělovač tisíců
 * („4.390.000 Kč" → 4390000), mezery, i nestandardní znaky (zwnj/zwj).
 * Desetinnou tečku („4.5") ponechává — skutečné ceny nemovitostí jsou
 * v CZK celá čísla, tečka za první skupinou číslic = tisíce.
 */
export function parseCzkPrice(text: string): number {
  let cleaned = text
    .replace(/[\u200d\u200c]/g, "")
    .replace(/&zwnj;/g, "")
    .replace(/&zwj;/g, "")
    .replace(/\s/g, "")
    .replace(/Kč.*$/i, "")
    .trim();
  // České tisíce s tečkou: „4.390.000" → „4390000" (vzor \.\d{3} = tisíce)
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "");
  }
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return 0;
  return num;
}

export interface RawListing {
  portalName: PortalName;
  url: string;
  title: string;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  floorArea?: number | null;
  usableArea?: number | null;
  rooms: string | null;
  floor: number | null;
  condition: string | null;
  buildingType: string | null;
  yearBuilt: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  contactPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  description: string | null;
  imageUrls: string[];
  publishedAt: number;
  updatedAt: number;
  /** Celkový počet podlaží budovy (pro podkroví/nejvyšší patro). */
  totalFloors?: number | null;
  /** Má dům výtah? (sreality POI / detail). */
  elevator?: boolean | null;
  /** Vlastnictví: personal | cooperative | other. */
  ownership?: "personal" | "cooperative" | "other" | null;
  /** Balkón/lodžie/terasa v m². */
  balconyArea?: number | null;
  /** Vlastní zahrada/předzahrádka v m². */
  gardenArea?: number | null;
  /** Sklep v m². */
  cellarArea?: number | null;
  /* Realingo integrace */
  realingoId?: string | null;
  priceRating?: string | null;
  priceTier?: string | null;
  priceRatingJson?: string | null;
  isEarlyOffer?: boolean | null;
}
