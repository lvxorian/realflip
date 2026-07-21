import { PortalAdapter } from "./base";
import { RawListing, SearchFilters, filterImages, isValidPrice } from "../types";
import { inferConditionFromText } from "@/lib/analysis/condition";

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

export class SrealityAdapter extends PortalAdapter {
  private baseApi = "https://www.sreality.cz/api/v1/estates";
  private resultsPerPage = 20;
  private maxPages = 25;

  constructor() {
    super("sreality");
  }

  async crawlListings(filters?: SearchFilters): Promise<RawListing[]> {
    const all: RawListing[] = [];

    for (let page = 0; page < this.maxPages; page++) {
      const offset = page * this.resultsPerPage;
      const url = `${this.baseApi}/search?category_main_cb=1&category_type_cb=1&limit=${this.resultsPerPage}&offset=${offset}`;

      const data = await this.fetchJson(url);
      const items: SrealitySearchResult[] = data?.results ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        const locality = item.locality;
        const city = locality?.city ?? null;
        const street = locality?.street ?? null;
        const streetNumber = locality?.housenumber ?? null;
        const address = [street, streetNumber, city].filter(Boolean).join(" ") || null;

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

      if (items.length < this.resultsPerPage) break;
    }

    const enriched: RawListing[] = [];
    for (const l of all) {
      enriched.push(await this.enrichListing(l));
    }
    return enriched;
  }

  private async enrichListing(listing: RawListing): Promise<RawListing> {
    try {
      const id = listing.url.split("/").pop();
      if (!id || !/^\d+$/.test(id)) return listing;

      const data: SrealityDetail = await this.fetchJson(`${this.baseApi}/${id}`);
      const r = data.result;
      if (!r) return listing;

      if (r.advert_name) listing.title = r.advert_name;
      if (r.advert_description) listing.description = r.advert_description;

      const roomsLabel: string = r.category_sub_cb?.name ?? "";
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
      listing.area = r.usable_area ?? r.floor_area ?? listing.area;

      const detailLocality = r.locality;
      if (detailLocality) {
        const city = detailLocality.city ?? null;
        const street = detailLocality.street ?? null;
        const streetNumber = detailLocality.streetnumber ?? null;
        listing.address = [street, streetNumber, city].filter(Boolean).join(" ") || listing.address;
        listing.lat = detailLocality.gps_lat ?? listing.lat;
        listing.lng = detailLocality.gps_lon ?? listing.lng;
      }

      // Fix URL with enriched data (rooms + location slug)
      const hashId = listing.url.split("/").pop() ?? "";
      const enrichedRooms = r.category_sub_cb?.name
        ? r.category_sub_cb.name.replace(/^(\d+\+\w+).*$/, "$1").toLowerCase()
        : "";
      listing.url = buildSrealityDetailUrl(parseInt(hashId) || 0, enrichedRooms, r.locality);

      listing.imageUrls = filterImages(
        (r.advert_images ?? []).map((img: any) => img.url ?? img.advert_image_sdn_url ?? ""),
        this.config.name,
      );

      if (r.user) {
        listing.contactName = r.user.user_name ?? null;
        listing.contactEmail = r.user.user_email ?? null;
        listing.contactPhone = r.user.user_phones?.[0]?.phone ?? null;
      }

      if (r.since) listing.publishedAt = new Date(r.since).getTime();
      if (r.edited) listing.updatedAt = new Date(r.edited).getTime();

      if (listing.price === 0 && r.price_czk) listing.price = r.price_czk;
    } catch {
      // enrichment is optional
    }

    // Fallback: extract images from HTML __NEXT_DATA__ if API returned none
    if (listing.imageUrls.length === 0) {
      try {
        const html = await this.fetch(listing.url);
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
        if (match) {
          const nextData = JSON.parse(match[1]);
          const queries = nextData.props?.pageProps?.dehydratedState?.queries ?? [];
          const detailQuery = queries.find((q: any) => q.state?.data?.result?.advert_name);
          if (detailQuery) {
            const r = detailQuery.state.data.result;
            if (r?.advert_images) {
              listing.imageUrls = filterImages(
                (r.advert_images ?? []).map((img: any) => img.url ?? img.advert_image_sdn_url ?? ""),
                this.config.name,
              );
            }
          }
        }
      } catch {
        // HTML fallback is optional
      }
    }

    return listing;
  }

  extractContact(_html: string): { phone: string | null; name: string | null; email: string | null } {
    return { phone: null, name: null, email: null };
  }

  private async fetchJson(url: string): Promise<any> {
    await this.rateLimiter.wait(this.config.name);
    const response = await globalThis.fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "cs,en;q=0.9",
        Referer: "https://www.sreality.cz/",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.json();
  }
}
