import * as cheerio from "cheerio";
import { RawListing, PortalName, filterImages, isValidPrice } from "./types";
import { RateLimiter } from "./rate-limiter";
import { inferConditionFromText } from "@/lib/analysis/condition";

const rateLimiter = RateLimiter.getInstance();

function normalizeBuildingType(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (/cihlov/i.test(v)) return "brick";
  if (/panelov/i.test(v)) return "panel";
  if (/skletov|skeletov/i.test(v)) return "mixed";
  if (/sm[íi]šen/i.test(v)) return "mixed";
  if (/montovan/i.test(v)) return "panel";
  if (/d[řr]evostavba|modul[áa]rn/i.test(v)) return "new";
  if (/kamenn/i.test(v)) return "brick";
  return null;
}

function inferBuildingType(description: string | null, title: string | null): string | null {
  const text = [description, title].filter(Boolean).join(" ").toLowerCase();
  if (/cihlov[éý]/i.test(text)) return "brick";
  if (/panel[ovýáé]/i.test(text)) return "panel";
  if (/novostavba|nov[ýá]\s+objekt/i.test(text)) return "new";
  if (/sm[íi]šen[ýé]/i.test(text)) return "mixed";
  return null;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
];

let cookieJar: string | null = null;
let cookieExpiry = 0;

async function ensureCookie(portal: string): Promise<void> {
  if (cookieJar && Date.now() < cookieExpiry) return;
  await rateLimiter.wait(portal, 2000);
  try {
    const res = await globalThis.fetch("https://www.sreality.cz/", {
      headers: {
        "User-Agent": USER_AGENTS[0],
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "cs,en;q=0.9",
      },
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      cookieJar = setCookie.split(";")[0];
      cookieExpiry = Date.now() + 600_000;
    }
  } catch {
    // cookies are optional
  }
}

async function fetchWithRetry(url: string, portal: string, accept: string, referer?: string, maxRetries = 2): Promise<{ text: string; status: number }> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.wait(portal, 2000);
      const ua = USER_AGENTS[attempt % USER_AGENTS.length];
      const headers: Record<string, string> = {
        "User-Agent": ua,
        Accept: accept,
        "Accept-Language": "cs,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": accept.startsWith("application/json") ? "empty" : "document",
        "Sec-Fetch-Mode": accept.startsWith("application/json") ? "cors" : "navigate",
        "Sec-Fetch-Site": "same-origin",
      };
      if (referer) headers.Referer = referer;
      if (cookieJar) headers.Cookie = cookieJar;

      const response = await globalThis.fetch(url, { headers });

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 30000;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (response.ok) {
        return { text: await response.text(), status: response.status };
      }

      lastErr = new Error(`HTTP ${response.status}: ${url}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error(`Failed to fetch: ${url}`);
}

async function fetchHtml(url: string, portal: string): Promise<string> {
  const { text } = await fetchWithRetry(url, portal, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", url);
  return text;
}

async function fetchJson(url: string, portal: string, headers?: Record<string, string>): Promise<any> {
  const { text } = await fetchWithRetry(url, portal, "application/json, text/plain, */*", "https://www.sreality.cz/");
  return JSON.parse(text);
}

function cleanText(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/\s+/g, " ").trim();
}

function extractPrice(text: string): number {
  const cleaned = text.replace(/\s/g, "").replace(/Kč.*$/i, "").trim();
  const num = parseInt(cleaned);
  if (isNaN(num)) return 0;
  return isValidPrice(num) ? num : 0;
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

async function scrapeSreality(url: string): Promise<RawListing> {
  const segments = url.replace(/\/+$/, "").split("/");
  const id = segments[segments.length - 1];
  if (!/^\d+$/.test(id)) throw new Error("Nelze parsovat ID inzerátu z URL");

  await ensureCookie("sreality");

  let data: any;
  try {
    data = await fetchJson(`https://www.sreality.cz/api/v1/estates/${id}`, "sreality");
  } catch {
    const html = await fetchHtml(url, "sreality");
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
    if (!match) throw new Error("Nepodařilo se načíst data inzerátu");
    const nextData = JSON.parse(match[1]);
    const queries = nextData.props?.pageProps?.dehydratedState?.queries ?? [];
    const detailQuery = queries.find((q: any) => q.state?.data?.result?.advert_name);
    if (!detailQuery) throw new Error("Nepodařilo se najít data inzerátu v HTML");
    data = { result: detailQuery.state.data.result };
  }
  const r = data.result;
  if (!r) throw new Error("API nevrátilo data inzerátu");

  const locality = r.locality ?? {};
  const city = locality.city ?? null;
  const street = locality.street ?? null;
  const streetNumber = locality.streetnumber ?? null;
  const address = [street, streetNumber, city].filter(Boolean).join(" ") || null;

  const subCb = r.category_sub_cb ?? {};
  const roomsLabel: string = subCb.name ?? null;
  const roomsClean = roomsLabel ? roomsLabel.replace(/^(\d+\+\w+).*$/, "$1") : null;

  const buildingConditionRaw = r.building_condition?.name ?? null;
  const condition = inferConditionFromText(
    r.advert_description ?? "",
    r.advert_name ?? "",
    buildingConditionRaw,
  );

  const buildingType = normalizeBuildingType(r.building_type?.name ?? null);

  const images: string[] = filterImages(
    (r.advert_images ?? []).map((img: any) => img.url ?? img.advert_image_sdn_url ?? ""),
    "sreality",
  ).map((url) => url + "?fl=res,1200,1200,1|wrm,/watermark/sreality.png,10|shr,,20|webp,80");

  const floorNumber = typeof r.floor_number === "number" ? r.floor_number : null;
  const usableArea = typeof r.usable_area === "number" ? r.usable_area : typeof r.floor_area === "number" ? r.floor_area : null;
  const gardenArea = typeof r.garden_area === "number" ? r.garden_area : null;
  const balconyArea = typeof r.balcony_area === "number" ? r.balcony_area : null;

  return {
    portalName: "sreality",
    url,
    title: r.advert_name ?? "",
    price: r.price_czk ?? r.price ?? 0,
    pricePerSqm: r.price_czk_m2 ?? null,
    area: usableArea,
    rooms: roomsClean,
    floor: floorNumber,
    condition,
    buildingType,
    yearBuilt: r.acceptance_year ?? null,
    address,
    lat: locality.gps_lat ?? null,
    lng: locality.gps_lon ?? null,
    contactPhone: r.user?.user_phones?.[0]?.phone ?? null,
    contactName: r.user?.user_name ?? null,
    contactEmail: r.user?.user_email ?? null,
    description: r.advert_description ?? null,
    imageUrls: images,
    publishedAt: r.since ? new Date(r.since).getTime() : Date.now(),
    updatedAt: r.edited ? new Date(r.edited).getTime() : Date.now(),
  };
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
  let buildingType: string | null = null;
  let floor: number | null = null;
  let yearBuilt: number | null = null;

  $("table.detailbytu tr").each((_, row) => {
    const th = cleanText($(row).find("th").text()) ?? "";
    const td = cleanText($(row).find("td").text()) ?? "";
    if (/velikost/i.test(th)) rooms = extractRooms(td) || td;
    if (/stav/i.test(th) || /druh.*budovy/i.test(th)) condition = td;
    if (/konstrukce/i.test(th) || /materi[áa]l/i.test(th)) buildingType = td;
    if (/patro/i.test(th)) floor = parseInt(td) || null;
    if (/(výstavba|rok)/i.test(th)) yearBuilt = parseInt(td) || null;
  });

  condition = inferConditionFromText(condition, description, title) ?? null;
  buildingType = normalizeBuildingType(buildingType) ?? inferBuildingType(description, title);

  let images: string[] = [];
  $("div#galerie a[href^='/photo/']").each((_, el) => {
    const src = $(el).attr("href");
    if (src) images.push(src);
  });
  if (images.length === 0) {
    $("a#mainfoto img").each((_, el) => {
      const src = $(el).attr("src");
      if (src) images.push(src);
    });
  }
  images = filterImages(images, "reality-cz");

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
    buildingType,
    yearBuilt,
    address,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: Date.now(),
    updatedAt: Date.now(),
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
  let buildingType: string | null = null;
  let floor: number | null = null;
  let yearBuilt: number | null = null;
  let address: string | null = null;

  $(".c-ad-detail__parameters-item").each((_, item) => {
    const label = cleanText($(item).find(".c-ad-detail__parameters-item__label").text()) ?? "";
    const value = cleanText($(item).find(".c-ad-detail__parameters-item__value").text()) ?? "";
    if (/plocha/i.test(label)) area = extractArea(value);
    if (/dispozice/i.test(label)) rooms = extractRooms(value) || value;
    if (/stav/i.test(label)) condition = value;
    if (/(konstrukce|materi[áa]l)/i.test(label)) buildingType = value;
    if (/patro/i.test(label)) floor = parseInt(value) || null;
    if (/(výstavba|rok)/i.test(label)) yearBuilt = parseInt(value) || null;
  });

  condition = inferConditionFromText(condition, description, title) ?? null;
  buildingType = normalizeBuildingType(buildingType) ?? inferBuildingType(description, title);

  const addressEl = cleanText($(".c-ad-detail__header-info-location").text());
  address = addressEl ?? title;

  let images: string[] = [];
  $(".c-gallery-list__item img.js-gallery-item").each((_, el) => {
    const src = $(el).attr("data-gallery-full-url");
    if (src) images.push(src);
  });
  images = filterImages(images, "hyperinzerce");

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
    buildingType,
    yearBuilt,
    address,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: Date.now(),
    updatedAt: Date.now(),
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
  const buildingType = inferBuildingType(description, title);

  let images: string[] = [];
  if (scriptJson) {
    try {
      const data = JSON.parse(scriptJson);
      if (data?.image) images = Array.isArray(data.image) ? data.image : [data.image];
    } catch { /* ignore */ }
  }
  images = filterImages(images, "annonce");

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
    buildingType,
    yearBuilt: null,
    address: title,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function scrapeBazos(url: string): Promise<RawListing> {
  const html = await fetchHtml(url, "bazos");
  const $ = cheerio.load(html);

  const title = cleanText($("h1.nadpisdetail").text()) ?? cleanText($("title").text()) ?? "";

  let price = 0;
  const priceText = $("div.popisdetail b:contains('Kč'), div.popisdetail strong:contains('Kč'), td:contains('Cena') + td b, td:contains('Cena') b").first().text();
  if (priceText) {
    price = extractPrice(priceText);
  }
  if (price === 0) {
    $("td b:contains('Kč')").each((_, el) => {
      const t = $(el).text();
      const p = extractPrice(t);
      if (p > 0 && p > price) price = p;
    });
  }

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
  const buildingType = inferBuildingType(description, title);

  let images: string[] = [];
  $("img.carousel-cell-image").each((_, el) => {
    const src = $(el).attr("data-flickity-lazyload") || $(el).attr("src");
    if (src && !src.startsWith("data:image/gif")) images.push(src);
  });
  images = filterImages(images, "bazos");

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
    buildingType,
    yearBuilt: null,
    address: title,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: Date.now(),
    updatedAt: Date.now(),
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
  const buildingType = inferBuildingType(description, title);

  let images: string[] = [];
  $("img.rds-image").each((_, el) => {
    const src = $(el).attr("src");
    if (src) images.push(src);
  });
  images = filterImages(images, "mmreality");

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
    buildingType,
    yearBuilt: null,
    address: title,
    lat: null,
    lng: null,
    contactPhone: null,
    contactName: null,
    contactEmail: null,
    description,
    imageUrls: images,
    publishedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeNotImplementedScraper(portal: string, hint: string) {
  return async (_url: string): Promise<RawListing> => {
    throw new Error(`${portal}: ${hint}`);
  };
}

async function scrapeIdnesReality(url: string): Promise<RawListing> {
  const html = await fetchHtml(url, "idnes-reality");
  const $ = cheerio.load(html);

  const title = cleanText($("h1.b-detail__title span").text()) ?? cleanText($("title").text()) ?? "";
  const address = cleanText($("p.b-detail__info").text()) ?? title;

  const priceStr = $("p.b-detail__price strong").text();
  const price = extractPrice(priceStr);

  const descEl = $("div.b-desc p");
  const description = descEl.length ? descEl.text().replace(/\s+/g, " ").trim() : null;

  let images: string[] = [];
  $("a.carousel__item img").each((_, el) => {
    const src = $(el).attr("data-lazy") || $(el).attr("src");
    if (src && !src.includes("no-image")) images.push(src);
  });
  images = filterImages(images, "idnes-reality").map(
    (url) => url + (url.includes("?") ? "&" : "?") + "fl=res,1200,900,1"
  );

  const paramMap: Record<string, string> = {};
  $("div.b-definition-columns dl dt").each((i, dtEl) => {
    const key = $(dtEl).text().trim().toLowerCase();
    const dd = $(dtEl).next("dd");
    const val = dd.text().trim();
    paramMap[key] = val;
  });

  let area: number | null = null;
  const areaStr = paramMap["užitná plocha"];
  if (areaStr) {
    const m = areaStr.match(/(\d[\s\d]*)/);
    if (m) area = parseInt(m[1].replace(/\s/g, ""));
  }
  if (!area) {
    const areaMatch = title.match(/(\d+)\s*m/i);
    if (areaMatch) area = parseInt(areaMatch[1]);
  }

  let rooms = extractRooms(title);
  if (!rooms) {
    const rm = title.match(/(\d+\+kk|\d+\+1|\d\+kk|\d\+1|garsonka|atypick[eé]ho)/i);
    if (rm) {
      rooms = rm[1].toLowerCase();
      if (rooms === "garsonka" || rooms === "atypického") rooms = "1+kk";
    }
  }

  const floorStr = paramMap["podlaží"];
  let floor: number | null = null;
  if (floorStr) {
    const fm = floorStr.match(/(\d+)\./);
    if (fm) floor = parseInt(fm[1]);
  }

  const conditionStr = paramMap["stav bytu"] || paramMap["stav budovy"] || "";
  let condition: string | null = null;
  if (conditionStr) {
    if (/velmi dobr[ýy]/.test(conditionStr) || /dobr[ýy]/.test(conditionStr)) condition = "good";
    else if (/novos?tavba|nov[ýy]/.test(conditionStr)) condition = "new";
    else if (/rekonstru/.test(conditionStr)) condition = "renovated";
    else if (/původn[íi]/.test(conditionStr)) condition = "original";
    else if (/špatn[ýy]|zchátral/.test(conditionStr) || /k demolici/.test(conditionStr)) condition = "dilapidated";
  }
  if (!condition) condition = inferConditionFromText(description, title);

  const buildStr = paramMap["konstrukce budovy"] || "";
  let buildingType: string | null = null;
  if (buildStr) {
    if (/panel/.test(buildStr)) buildingType = "panel";
    else if (/cihl/.test(buildStr)) buildingType = "brick";
    else if (/smíšen/.test(buildStr)) buildingType = "mixed";
    else if (/novos?tavba/.test(buildStr)) buildingType = "new";
  }
  if (!buildingType) buildingType = inferBuildingType(description, title);

  let contactPhone: string | null = null;
  let contactEmail: string | null = null;
  let contactName: string | null = null;
  $('a[href^="tel:"]').each((_, el) => {
    const tel = $(el).attr("href")?.replace("tel:", "").trim() || null;
    if (tel) contactPhone = tel;
  });
  $('a[href^="mailto:"]').each((_, el) => {
    const mail = $(el).attr("href")?.replace("mailto:", "").trim() || null;
    if (mail) contactEmail = mail;
  });
  const nameText = $("div.b-detail__user-text").text().trim() ||
    $("p.b-detail__user-name").text().trim() ||
    $("span.b-detail__user-name").text().trim() ||
    $("a[href^='tel:']").closest("div").parent().find("p, span, a").not("[href]").first().text().trim() ||
    null;
  if (nameText) contactName = nameText;

  return {
    portalName: "idnes-reality" as PortalName,
    url,
    title,
    price,
    pricePerSqm: area && area > 0 ? Math.round(price / area) : null,
    area,
    rooms,
    floor,
    condition,
    buildingType,
    yearBuilt: null,
    address,
    lat: null,
    lng: null,
    contactPhone,
    contactName,
    contactEmail,
    description,
    imageUrls: images,
    publishedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const PORTAL_SCRAPERS: { pattern: RegExp; portal: string; scrape: (url: string) => Promise<RawListing> }[] = [
  { pattern: /sreality\.cz/, portal: "sreality", scrape: scrapeSreality },
  { pattern: /\breality\.cz/, portal: "reality-cz", scrape: scrapeRealityCz },
  { pattern: /hyperinzerce\.cz/, portal: "hyperinzerce", scrape: scrapeHyperinzerce },
  { pattern: /annonce\.cz/, portal: "annonce", scrape: scrapeAnnonce },
  { pattern: /bazos\.cz/, portal: "bazos", scrape: scrapeBazos },
  { pattern: /mmreality\.cz/, portal: "mmreality", scrape: scrapeMmreality },
  { pattern: /bezrealitky\.cz/, portal: "bezrealitky", scrape: makeNotImplementedScraper("bezrealitky", "Next.js SPA — detail scraper není implementován") },
  { pattern: /idnes-reality\.cz/, portal: "idnes-reality", scrape: scrapeIdnesReality },
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

  throw new Error("Neznámý realitní portál — podporujeme: sreality.cz, reality.cz, hyperinzerce.cz, annonce.cz, bazos.cz, mmreality.cz");
}

export function detectPortal(url: string): string | null {
  for (const { pattern, portal } of PORTAL_SCRAPERS) {
    if (pattern.test(url)) return portal;
  }
  return null;
}
