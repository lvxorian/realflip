import { PortalAdapter, CrawlStep } from "./base";
import { RawListing, SearchFilters, filterImages, isValidPrice, cleanHtmlToText } from "../types";
import { inferConditionFromText } from "@/lib/analysis/condition";
import { cityNamesFor, addressMatchesCity, findCityKey } from "@/lib/analysis/location";

interface SrealitySearchResult {
  hash_id: number;
  name: string | null;
  price: number;
  price_czk_m2: number | null;
  usable_area: number | null;
  locality: {
    city: string | null;
    city_seo_name: string | null;
    street: string | null;
    street_seo_name: string | null;
    housenumber: string | null;
    gps_lat: number | null;
    gps_lon: number | null;
  } | null;
}

/** Výsledek v __NEXT_DATA__ městské stránky (sreality.cz/hledani/prodej/byty/{mesto}). */
interface SrealityCityResult {
  id: number;
  name: string | null;
  priceCzk: number;
  priceCzkPerSqM: number | null;
  locality: {
    city: string | null;
    citySeoName: string | null;
    street: string | null;
    streetSeoName: string | null;
    streetNumber: string | null;
    cityPartSeoName: string | null;
    districtSeoName: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  images: Array<{ url?: string } | string> | null;
}

interface SrealityDetail {
  result: {
    advert_name: string | null;
    advert_description: string | null;
    price_czk: number;
    price_czk_m2: number | null;
    usable_area: number | null;
    floor_area: number | null;
    building_condition: { name: string } | null;
    building_type: { name: string } | null;
    acceptance_year: number | null;
    floor_number: number | null;
    category_sub_cb: { name: string } | null;
    locality: {
      city: string | null;
      city_seo_name: string | null;
      street: string | null;
      street_seo_name: string | null;
      citypart_seo_name: string | null;
      district_seo_name: string | null;
      streetnumber: string | null;
      gps_lat: number | null;
      gps_lon: number | null;
    } | null;
    advert_images: { url: string }[];
    user: {
      user_name: string | null;
      user_email: string | null;
      user_phones: { phone: string }[];
    } | null;
    since: string | null;
    edited: string | null;
  };
}

function extractRoomsFromName(name: string): string {
  const m = name.match(/(\d+\+\w{2})/i);
  return m ? m[1].toLowerCase() : "";
}

function buildSrealityDetailUrl(
  hashId: number,
  rooms: string,
  locality: {
    city_seo_name?: string | null;
    street_seo_name?: string | null;
    citypart_seo_name?: string | null;
    district_seo_name?: string | null;
  } | null,
): string {
  const base = `https://www.sreality.cz/detail/prodej/byt`;
  const roomsSlug = rooms.toLowerCase().replace(/\s/g, "");
  if (!locality?.city_seo_name || !roomsSlug) {
    return `${base}/${hashId}`;
  }
  const city = locality.city_seo_name;
  const district = locality.citypart_seo_name || locality.district_seo_name || city;
  const street = locality.street_seo_name ?? "";
  const slug = street ? `${city}-${district}-${street}` : `${city}-${district}-`;
  return `${base}/${roomsSlug}/${slug}/${hashId}`;
}

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

const SREALITY_CDN_PARAMS = "?fl=res,1200,1200,1|wrm,/watermark/sreality.png,10|shr,,20|webp,80";

/** SEO názvy měst, kde cityKey (podtržítka) nesedí s URL sreality. */
const SREALITY_CITY_SEO: Record<string, string> = {
  hradec: "hradec-kralove",
  usti: "usti-nad-labem",
  mariansk_lazne: "marianske-lazne",
};

export class SrealityAdapter extends PortalAdapter {
  private baseApi = "https://www.sreality.cz/api/v1/estates";
  private resultsPerPage = 20;
  private maxPages = 5;

  constructor() {
    super("sreality");
  }

  async crawlListings(filters?: SearchFilters, ctx?: CrawlStep): Promise<RawListing[]> {
    const all: RawListing[] = [];
    const cityNames = filters?.location
      ? cityNamesFor(findCityKey(filters.location) ?? filters.location.toLowerCase().replace(/\s+/g, "_"))
      : null;

    await this.forPages(ctx, this.maxPages, async (page) => {
      const offset = (page - 1) * this.resultsPerPage;
      let url = `${this.baseApi}/search?category_main_cb=1&category_type_cb=1&limit=${this.resultsPerPage}&offset=${offset}`;
      if (filters?.priceMin) url += `&price_min=${filters.priceMin}`;
      if (filters?.priceMax) url += `&price_max=${filters.priceMax}`;
      if (filters?.areaMin) url += `&usable_area_min=${filters.areaMin}`;
      if (filters?.areaMax) url += `&usable_area_max=${filters.areaMax}`;

      const data = await this.fetchJson(url);
      const items: SrealitySearchResult[] = data?.results ?? [];

      for (const item of items) {
        const locality = item.locality;
        const city = locality?.city ?? null;
        const street = locality?.street ?? null;
        const streetNumber = locality?.housenumber ?? null;
        const address = [street, streetNumber, city].filter(Boolean).join(" ") || null;
        if (cityNames && !addressMatchesCity(address, cityNames)) continue;

        const rawPrice = item.price ?? 0;
        if (!isValidPrice(rawPrice)) continue;

        const roomsStr = extractRoomsFromName(item.name ?? "");
        all.push({
          portalName: "sreality",
          url: buildSrealityDetailUrl(item.hash_id, roomsStr, item.locality),
          title: item.name ?? "",
          price: rawPrice,
          pricePerSqm: item.price_czk_m2 ?? null,
          area: item.usable_area ?? null,
          floorArea: null,
          usableArea: item.usable_area ?? null,
          rooms: null,
          floor: null,
          condition: null,
          buildingType: null,
          yearBuilt: null,
          address,
          lat: locality?.gps_lat ?? null,
          lng: locality?.gps_lon ?? null,
          contactPhone: null,
          contactName: null,
          contactEmail: null,
          description: null,
          imageUrls: [],
          publishedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      return items.length < this.resultsPerPage ? 0 : items.length;
    });

    return this.enrichBatch(all, (l) => this.enrichListing(l), 3, ctx);
  }

  /**
   * URL inzerátů, které už máme v DB — pro městský crawl si z nich odvodíme
   * známá hash ID a přeskočíme drahé detail fetche (list data z městské
   * stránky stačí na aktualizaci ceny/živosti). Nastavuje orchestrator.
   */
  private knownHashIds: Set<number> = new Set();

  setKnownUrls(urls: Set<string>): void {
    this.knownHashIds = new Set();
    for (const url of urls) {
      const m = url.match(/\/(\d+)$/);
      if (m) this.knownHashIds.add(parseInt(m[1], 10));
    }
  }

  /**
   * Městský crawl přes stránky sreality.cz/hledani/prodej/byty/{mesto} —
   * výsledky (cena, lokalita, fotky) jsou v __NEXT_DATA__, takže netřeba
   * drahé detail fetche. Detail fetch dostanou jen NOVÉ inzeráty (do limitu);
   * známé z DB se jen aktualizují z list dat. Dřív se náhodně vzorkovalo až
   * 80 ID ze sitemapy na město (≈160 s s rate limiterem) — na 60 s limit
   * Vercelu to nikdy nestačilo a běh se po každém přerušení lezl od nuly.
   */
  async crawlCityListings(cityKey: string, limit = 40, ctx?: CrawlStep): Promise<RawListing[]> {
    const cityNames = cityNamesFor(cityKey);
    const seo = SREALITY_CITY_SEO[cityKey] ?? cityKey.replace(/_/g, "-");
    const raw: RawListing[] = [];

    await this.forPages(ctx, this.maxPages, async (page) => {
      const url = page === 1
        ? `https://www.sreality.cz/hledani/prodej/byty/${seo}`
        : `https://www.sreality.cz/hledani/prodej/byty/${seo}?strana=${page}`;
      const html = await this.fetch(url);
      const items = this.parseCityPage(html, cityNames);
      raw.push(...items);
      return items.length;
    });

    // Dedup podle hash ID (paginace vrací duplicity).
    const byId = new Map<number, RawListing>();
    for (const l of raw) {
      const m = l.url.match(/\/(\d+)$/);
      if (!m) continue;
      byId.set(parseInt(m[1], 10), l);
    }

    // Známé inzeráty necháme jen z list dat (cena, lokalita, fotky) —
    // detail fetch pro ně je zbytečný. Nové do detailu dotáhneme (do limitu).
    const fresh: RawListing[] = [];
    const known: RawListing[] = [];
    for (const [id, l] of byId) {
      if (this.knownHashIds.has(id)) known.push(l);
      else fresh.push(l);
    }

    const enriched = await this.enrichBatch(
      fresh.slice(0, Math.max(limit, 10)),
      (l) => this.enrichListing(l),
      3,
      ctx
    );

    return [...enriched, ...known];
  }

  /** Rozparsuje __NEXT_DATA__ městské stránky na list inzeráty. */
  private parseCityPage(html: string, cityNames: string[]): RawListing[] {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
    if (!match) return [];
    let data: any;
    try {
      data = JSON.parse(match[1]);
    } catch {
      return [];
    }
    const queries = data.props?.pageProps?.dehydratedState?.queries ?? [];
    const q = queries.find((query: any) =>
      JSON.stringify(query.queryKey ?? []).includes("estates")
    );
    const items: SrealityCityResult[] = q?.state?.data?.results ?? [];
    const listings: RawListing[] = [];

    for (const item of items) {
      const locality = item.locality;
      const city = locality?.city ?? null;
      const street = locality?.street ?? null;
      const streetNumber = locality?.streetNumber ?? null;
      const address = [street, streetNumber, city].filter(Boolean).join(" ") || null;
      if (!city || !addressMatchesCity(city, cityNames)) continue;

      const rawPrice = item.priceCzk ?? 0;
      if (!isValidPrice(rawPrice)) continue;

      const roomsStr = extractRoomsFromName(item.name ?? "");
      const imgUrls = (item.images ?? [])
        .map((img) => (typeof img === "string" ? img : img.url ?? ""));

      listings.push({
        portalName: "sreality",
        url: buildSrealityDetailUrl(item.id, roomsStr, {
          city_seo_name: locality?.citySeoName ?? null,
          street_seo_name: locality?.streetSeoName ?? null,
          citypart_seo_name: locality?.cityPartSeoName ?? null,
          district_seo_name: locality?.districtSeoName ?? null,
        }),
        title: item.name ?? "",
        price: rawPrice,
        pricePerSqm: item.priceCzkPerSqM ?? null,
        area: null,
        floorArea: null,
        usableArea: null,
        rooms: null,
        floor: null,
        condition: null,
        buildingType: null,
        yearBuilt: null,
        address,
        lat: locality?.latitude ?? null,
        lng: locality?.longitude ?? null,
        contactPhone: null,
        contactName: null,
        contactEmail: null,
        description: null,
        imageUrls: filterImages(imgUrls, this.config.name).map(
          (url) => url + SREALITY_CDN_PARAMS
        ),
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return listings;
  }

  private tryEnrichFromApi(id: string): Promise<SrealityDetail> {
    return this.fetchJson(`${this.baseApi}/${id}`);
  }

  private async tryEnrichFromHtml(url: string, listing: RawListing): Promise<void> {
    const html = await this.fetch(listing.url);
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
    if (!match) return;
    const nextData = JSON.parse(match[1]);
    const queries = nextData.props?.pageProps?.dehydratedState?.queries ?? [];
    const detailQuery = queries.find((q: any) => q.state?.data?.result?.advert_name);
    if (!detailQuery) return;
    const r = detailQuery.state.data.result;
    if (!r) return;

    const hashId = url.split("/").pop() ?? "";
    this.applyEnrichedData(listing, r, hashId);
  }

  private applyEnrichedData(listing: RawListing, r: any, hashId: string): void {
    if (r.advert_name) listing.title = r.advert_name;
    // Sreality API vrací popis jako HTML (<br />, <p>…) — převedeme na čistý text.
    if (r.advert_description) listing.description = cleanHtmlToText(r.advert_description);

    const roomsLabel = r.category_sub_cb?.name ?? "";
    listing.rooms = roomsLabel ? roomsLabel.replace(/^(\d+\+\w+).*$/, "$1") : null;

    const buildingConditionRaw = r.building_condition?.name ?? null;
    listing.condition = inferConditionFromText(
      listing.description ?? "",
      listing.title,
      buildingConditionRaw,
    );

    listing.buildingType = normalizeBuildingType(r.building_type?.name ?? null);
    listing.yearBuilt = r.acceptance_year ?? null;
    listing.floor = r.floor_number ?? null;
    listing.pricePerSqm = r.price_czk_m2 ?? listing.pricePerSqm;
    listing.usableArea = r.usable_area ?? listing.usableArea ?? null;
    listing.floorArea = r.floor_area ?? listing.floorArea ?? null;
    listing.area = r.usable_area ?? r.floor_area ?? listing.area;

    if (r.locality) {
      const city = r.locality.city ?? null;
      const street = r.locality.street ?? null;
      const streetNumber = r.locality.streetnumber ?? null;
      listing.address = [street, streetNumber, city].filter(Boolean).join(" ") || listing.address;
      listing.lat = r.locality.gps_lat ?? listing.lat;
      listing.lng = r.locality.gps_lon ?? listing.lng;
    }

    const enrichedRooms = r.category_sub_cb?.name
      ? r.category_sub_cb.name.replace(/^(\d+\+\w+).*$/, "$1").toLowerCase()
      : "";
    listing.url = buildSrealityDetailUrl(parseInt(hashId) || 0, enrichedRooms, r.locality);

    listing.imageUrls = filterImages(
      (r.advert_images ?? []).map((img: any) => img.url ?? img.advert_image_sdn_url ?? ""),
      this.config.name,
    ).map((url) => url + SREALITY_CDN_PARAMS);

    if (r.user) {
      listing.contactName = r.user.user_name ?? null;
      listing.contactEmail = r.user.user_email ?? null;
      listing.contactPhone = r.user.user_phones?.[0]?.phone ?? null;
    }

    if (r.since) listing.publishedAt = new Date(r.since).getTime();
    if (r.edited) listing.updatedAt = new Date(r.edited).getTime();
    if (listing.price === 0 && r.price_czk) listing.price = r.price_czk;
  }

  private async enrichListing(listing: RawListing): Promise<RawListing> {
    const id = listing.url.split("/").pop();
    if (!id || !/^\d+$/.test(id)) return listing;

    try {
      const data = await this.tryEnrichFromApi(id);
      if (data?.result) {
        this.applyEnrichedData(listing, data.result, id);
        return listing;
      }
    } catch {
      // API failed, try HTML fallback
    }

    try {
      await this.tryEnrichFromHtml(listing.url, listing);
    } catch {
      // HTML fallback is optional
    }

    return listing;
  }

  extractContact(_html: string): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }

  private async fetchJson(url: string): Promise<any> {
    await this.rateLimiter.wait(this.config.name);
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "cs,en;q=0.9",
      Referer: "https://www.sreality.cz/",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    };

    for (let attempt = 0; attempt <= 1; attempt++) {
      const response = await globalThis.fetch(url, {
        headers,
        // Zaseknutý požadavek nesmí zabít celý běh (limit 60 s).
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) return response.json();
      if (response.status === 429 || response.status === 403 || response.status === 404) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = Math.min(retryAfter ? parseInt(retryAfter) * 1000 : response.status === 429 ? 10000 : 5000, 10000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    throw new Error(`HTTP failed after retries: ${url}`);
  }
}
