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
    enabled: true,
    baseUrl: "https://www.hyperreality.cz",
    searchPath: "/vyhledavani",
    rateLimitMs: 2000,
    respectRobotsTxt: true,
    requiresJs: false,
  },
  remax: {
    name: "remax",
    enabled: true,
    baseUrl: "https://www.remax.cz",
    searchPath: "/nemovitosti",
    rateLimitMs: 3000,
    respectRobotsTxt: true,
    requiresJs: true,
  },
  century21: {
    name: "century21",
    enabled: true,
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
  /not-available/i, /not_available/i,
];

const PORTAL_BASE_URLS: Record<string, string> = {
  sreality: "https://www.sreality.cz",
  "reality-cz": "https://www.reality.cz",
  hyperinzerce: "https://byty.hyperinzerce.cz",
  annonce: "https://www.annonce.cz",
  bazos: "https://reality.bazos.cz",
  mmreality: "https://www.mmreality.cz",
  "idnes-reality": "https://reality.idnes.cz",
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

export function filterImages(urls: string[], portalName?: string): string[] {
  return urls
    .map((url) => normalizeImageUrl(url, portalName))
    .filter((url) => {
      if (!url || url.length < 10) return false;
      if (/^https?:\/\/\//.test(url)) return false;
      if (url.startsWith("data:image/svg+xml")) return false;
      return !PLACEHOLDER_IMAGE_PATTERNS.some((p) => p.test(url));
    });
}

export function isValidPrice(price: number): boolean {
  return price > 0 && price >= MIN_REAL_ESTATE_PRICE;
}

export interface RawListing {
  portalName: PortalName;
  url: string;
  title: string;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
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
}
