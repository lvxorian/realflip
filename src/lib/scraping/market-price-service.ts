interface CachedMarketData {
  city: string;
  medianPricePerSqm: number;
  p25PricePerSqm: number;
  p75PricePerSqm: number;
  sampleSize: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let memoryCache: Map<string, CachedMarketData> = new Map();

function cityKeyToSrealitySlug(key: string): string {
  return key.replace(/_/g, "-");
}

function extractNextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractPricesFromNextData(data: any): number[] {
  const queries = data.props?.pageProps?.dehydratedState?.queries ?? [];
  const searchQuery = queries.find((q: any) => q.queryKey?.[0] === "estatesSearch");
  if (!searchQuery) return [];
  const results = searchQuery.state?.data?.results ?? [];
  return results
    .map((r: any) => r.priceCzkPerSqM ?? r.price_czk_m2)
    .filter((p: number) => typeof p === "number" && p > 0);
}

function computeStats(prices: number[]): { median: number; p25: number; p75: number } | null {
  if (prices.length < 3) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    median: sorted[Math.floor(n / 2)],
    p25: sorted[Math.floor(n / 4)],
    p75: sorted[Math.floor(3 * n / 4)],
  };
}

async function fetchFromSreality(cityKey: string): Promise<CachedMarketData | null> {
  const slug = cityKeyToSrealitySlug(cityKey);
  const url = `https://www.sreality.cz/hledani/prodej/byty/${slug}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    html = await res.text();
  } catch {
    return null;
  }

  const data = extractNextData(html);
  if (!data) return null;

  const prices = extractPricesFromNextData(data);
  const stats = computeStats(prices);
  if (!stats) return null;

  const cached: CachedMarketData = {
    city: cityKey,
    medianPricePerSqm: stats.median,
    p25PricePerSqm: stats.p25,
    p75PricePerSqm: stats.p75,
    sampleSize: prices.length,
    fetchedAt: Date.now(),
  };

  memoryCache.set(cityKey, cached);
  return cached;
}

export async function getMarketPriceRange(
  cityKey: string
): Promise<{ low: number; high: number; median: number } | null> {
  const cached = memoryCache.get(cityKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { low: cached.p25PricePerSqm, high: cached.p75PricePerSqm, median: cached.medianPricePerSqm };
  }

  const data = await fetchFromSreality(cityKey);
  if (!data) return null;

  return { low: data.p25PricePerSqm, high: data.p75PricePerSqm, median: data.medianPricePerSqm };
}

export function clearCache() {
  memoryCache.clear();
}
