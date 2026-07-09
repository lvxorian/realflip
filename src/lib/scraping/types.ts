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
    searchPath: "/hledani/prodej/byty",
    rateLimitMs: 3000,
    respectRobotsTxt: true,
    requiresJs: true,
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
  yearBuilt: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  contactPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  description: string | null;
  imageUrls: string[];
  publishedAt: Date;
  updatedAt: Date;
}
