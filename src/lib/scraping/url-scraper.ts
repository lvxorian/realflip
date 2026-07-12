import * as cheerio from "cheerio";
import { RawListing, PortalName } from "./types";
import { RateLimiter } from "./rate-limiter";
import { inferConditionFromText } from "@/lib/analysis/condition";

const rateLimiter = RateLimiter.getInstance();

async function fetchHtml(url: string, portal: string): Promise<string> {
  await rateLimiter.wait(portal, 2000);
  const response = await globalThis.fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "cs,en;q=0.9,sk;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

function cleanText(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

function extractPrice(text: string): number {
  const cleaned = text.replace(/\s/g, "").replace(/Kč.*$/i, "").trim();
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractArea(text: string): number | null {
  const match = text.match(/(\d+[,.]?\d*)\s*m[²2]/i);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

function extractRooms(text: string): string | null {
  const patterns = [/(\d+\+[a-z]{2})/i, /(\d+\+1)/i, /(\d+)\s*\(\s*(\d+)\s*\+\s*(\d+)\s*\)/];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return null;
}

async function scrapeRealityCz(url: string): Promise<RawListing> {
  const html = await fetchHtml(url, "reality-cz");
  const $ = cheerio.load(html);

  const title = cleanText($("h2#znazev").text()) ?? cleanText($("title").text()) ?? "";
  const priceText = cleanText($("span.detcena").first().text()) ?? "";
  const price = extractPrice(priceText);

  const description = cleanText($("div#popis div.pr10").text()) ?? null;

  let area: number | null = null;
  $("table.detailbytu tr").each((_, row) => {
    const th = cleanText($(row).find("th").text()) ?? "";
    if (/plocha/i.test(th)) {
      const td = cleanText($(row).find("td").text()) ?? "";
      area = extractArea(td);
    }
  });

  let rooms: string | null = null;
  let condition: string | null = null;
  let floor: number | null = null;
  let yearBuilt: number | null = null;

  $("table.detailbytu tr").each((_, row) => {
    const th = cleanText($(row).find("th").text()) ?? "";
    const td = cleanText($(row).find("td").text()) ?? "";
    if (/velikost/i.test(th)) rooms = extractRooms(td) || td;
    if (/stav/i.test(th) || /druh.*budovy/i.test(th)) condition = td;
    if (/patro/i.test(th)) floor = parseInt(td) || null;
    if (/(výstavba|rok)/i.test(th)) yearBuilt = parseInt(td) || null;
  });

  condition = inferConditionFromText(condition, description, title) ?? null;

  const images: string[] = [];
  $("div#galerie a[href^='/photo/']").each((_, el) => {
    const src = $(el).attr("href");
    if (src) images.push(`https://www.reality.cz${src}`);
  });
  if (images.length === 0) {
    $("a#mainfoto img").each((_, el) => {
      const src = $(el).attr("src");
      if (src) images.push(`https://www.reality.cz${src}`);
    });
  }

  let address = cleanText($("div.moreobal div.fss").first().text()) ?? title;

  return {
    portalName: "reality-cz" as PortalName,
    url,
    title,
    price,
    pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
    area,
    rooms,
    floor,
    condition,
    yearBuilt,
    address,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: new Date(),
    updatedAt: new Date(),
  };
}

async function scrapeHyperinzerce(url: string): Promise<RawListing> {
  const html = await fetchHtml(url, "hyperinzerce");
  const $ = cheerio.load(html);

  const title = cleanText($("h1.c-ad-detail__header-title").text()) ?? cleanText($("title").text()) ?? "";
  const priceText = cleanText($(".c-ad-detail__info-price span").first().text()) ?? "";
  const price = extractPrice(priceText);

  const description = cleanText($("div.c-ad-detail__description-text").text()) ?? null;

  let area: number | null = null;
  let rooms: string | null = null;
  let condition: string | null = null;
  let floor: number | null = null;
  let yearBuilt: number | null = null;
  let address: string | null = null;

  $(".c-ad-detail__parameters-item").each((_, item) => {
    const label = cleanText($(item).find(".c-ad-detail__parameters-item__label").text()) ?? "";
    const value = cleanText($(item).find(".c-ad-detail__parameters-item__value").text()) ?? "";
    if (/plocha/i.test(label)) area = extractArea(value);
    if (/dispozice/i.test(label)) rooms = extractRooms(value) || value;
    if (/stav/i.test(label)) condition = value;
    if (/patro/i.test(label)) floor = parseInt(value) || null;
    if (/(výstavba|rok)/i.test(label)) yearBuilt = parseInt(value) || null;
  });

  condition = inferConditionFromText(condition, description, title) ?? null;

  const addressEl = cleanText($(".c-ad-detail__header-info-location").text());
  address = addressEl ?? title;

  const images: string[] = [];
  $(".c-gallery-list__item img.js-gallery-item").each((_, el) => {
    const src = $(el).attr("data-gallery-full-url");
    if (src) images.push(src);
  });

  return {
    portalName: "hyperinzerce" as PortalName,
    url,
    title,
    price,
    pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
    area,
    rooms,
    floor,
    condition,
    yearBuilt,
    address,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: new Date(),
    updatedAt: new Date(),
  };
}

async function scrapeAnnonce(url: string): Promise<RawListing> {
  const html = await fetchHtml(url, "annonce");
  const $ = cheerio.load(html);

  const title = cleanText($("h1").first().text()) ?? cleanText($("title").text()) ?? "";

  let price = 0;
  const scriptJson = $('script[type="application/ld+json"]').first().html();
  if (scriptJson) {
    try {
      const data = JSON.parse(scriptJson);
      price = data?.offers?.price ?? 0;
    } catch { /* ignore */ }
  }
  if (price === 0) {
    const priceText = cleanText($("strong.mini-sticker span").text()) ?? "";
    price = extractPrice(priceText);
  }

  const description = cleanText($("div.popisdetail").text()) ?? cleanText($('meta[name="description"]').attr("content") ?? null) ?? null;

  let area: number | null = null;
  $("li:contains('m²')").each((_, el) => {
    const t = $(el).text();
    const a = extractArea(t);
    if (a) area = a;
  });

  const rooms = extractRooms(title);
  const condition = inferConditionFromText(description, title) ?? null;

  const images: string[] = [];
  if (scriptJson) {
    try {
      const data = JSON.parse(scriptJson);
      if (data?.image) images.push(...(Array.isArray(data.image) ? data.image : [data.image]));
    } catch { /* ignore */ }
  }

  return {
    portalName: "annonce" as PortalName,
    url,
    title,
    price,
    pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
    area,
    rooms,
    floor: null,
    condition,
    yearBuilt: null,
    address: title,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: new Date(),
    updatedAt: new Date(),
  };
}

async function scrapeBazos(url: string): Promise<RawListing> {
  const html = await fetchHtml(url, "bazos");
  const $ = cheerio.load(html);

  const title = cleanText($("h1.nadpisdetail").text()) ?? cleanText($("title").text()) ?? "";

  let price = 0;
  $("td b:contains('Kč')").each((_, el) => {
    const t = $(el).text();
    const p = extractPrice(t);
    if (p > 0) price = p;
  });

  const description = cleanText($("div.popisdetail").text()) ?? null;

  let area: number | null = null;
  const areaMatch = title.match(/(\d+)\s*m[²2]/i);
  if (areaMatch) area = parseInt(areaMatch[1]);
  if (!area && description) {
    const descArea = extractArea(description);
    if (descArea) area = descArea;
  }

  const rooms = extractRooms(title);
  const condition = inferConditionFromText(description, title) ?? null;

  const images: string[] = [];
  $("img.carousel-cell-image").each((_, el) => {
    const src = $(el).attr("data-flickity-lazyload") || $(el).attr("src");
    if (src) images.push(src);
  });

  return {
    portalName: "bazos" as PortalName,
    url,
    title,
    price,
    pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
    area,
    rooms,
    floor: null,
    condition,
    yearBuilt: null,
    address: title,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: new Date(),
    updatedAt: new Date(),
  };
}

async function scrapeMmreality(url: string): Promise<RawListing> {
  const html = await fetchHtml(url, "mmreality");
  const $ = cheerio.load(html);

  const title = cleanText($("h1.rds-property-detail-title").text()) ?? cleanText($("title").text()) ?? "";
  const description = cleanText($('div[data-cy="description-content"]').text()) ?? null;

  let price = 0;
  const priceText = cleanText($("div.tw-text-text-price").text()) ?? "";
  price = extractPrice(priceText);

  let area: number | null = null;
  const areaMatch = (title + " " + (description ?? "")).match(/(\d+[,.]?\d*)\s*m[²2]/i);
  if (areaMatch) area = parseFloat(areaMatch[1].replace(",", "."));

  const rooms = extractRooms(title);
  const condition = inferConditionFromText(description, title) ?? null;

  const images: string[] = [];
  $("img.rds-image").each((_, el) => {
    const src = $(el).attr("src");
    if (src) images.push(src);
  });

  return {
    portalName: "mmreality" as PortalName,
    url,
    title,
    price,
    pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
    area,
    rooms,
    floor: null,
    condition,
    yearBuilt: null,
    address: title,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeNotImplementedScraper(portal: string, hint: string) {
  return async (_url: string): Promise<RawListing> => {
    throw new Error(`${portal}: ${hint}`);
  };
}

const PORTAL_SCRAPERS: { pattern: RegExp; portal: string; scrape: (url: string) => Promise<RawListing> }[] = [
  { pattern: /sreality\.cz/, portal: "sreality", scrape: makeNotImplementedScraper("sreality", "Portál vyžaduje JS a autentizaci API — scraping není možný") },
  { pattern: /\breality\.cz/, portal: "reality-cz", scrape: scrapeRealityCz },
  { pattern: /hyperinzerce\.cz/, portal: "hyperinzerce", scrape: scrapeHyperinzerce },
  { pattern: /annonce\.cz/, portal: "annonce", scrape: scrapeAnnonce },
  { pattern: /bazos\.cz/, portal: "bazos", scrape: scrapeBazos },
  { pattern: /mmreality\.cz/, portal: "mmreality", scrape: scrapeMmreality },
  { pattern: /bezrealitky\.cz/, portal: "bezrealitky", scrape: makeNotImplementedScraper("bezrealitky", "Next.js SPA — detail scraper není implementován") },
  { pattern: /idnes-reality\.cz/, portal: "idnes-reality", scrape: makeNotImplementedScraper("idnes-reality", "JS SPA — detail scraper není implementován") },
  { pattern: /hyperreality\.cz/, portal: "hyperreality", scrape: makeNotImplementedScraper("hyperreality", "Portál není dostupný") },
  { pattern: /remax\.cz/, portal: "remax", scrape: makeNotImplementedScraper("remax", "Detail scraper není implementován") },
  { pattern: /century21\.cz/, portal: "century21", scrape: makeNotImplementedScraper("century21", "Detail scraper není implementován") },
];

export interface ScrapeResult {
  portal: string;
  listing: RawListing;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const trimmed = url.trim();
  if (!trimmed.startsWith("http")) throw new Error("Neplatná URL — musí začínat http:// nebo https://");

  for (const { pattern, portal, scrape } of PORTAL_SCRAPERS) {
    if (pattern.test(trimmed)) {
      const listing = await scrape(trimmed);
      return { portal, listing };
    }
  }

  throw new Error("Neznámý realitní portál — podporujeme: reality.cz, hyperinzerce.cz, annonce.cz, bazos.cz, mmreality.cz");
}

export function detectPortal(url: string): string | null {
  for (const { pattern, portal } of PORTAL_SCRAPERS) {
    if (pattern.test(url)) return portal;
  }
  return null;
}
