const SITEMAP_PARTS = ["sitemap1", "sitemap2", "sitemap3", "sitemap4", "sitemap5", "sitemap6"];

export const SITEMAP_TTL_MS = 24 * 60 * 60 * 1000;

const SREALITY_SITEMAP_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "*/*",
  "Accept-Language": "cs,en;q=0.9",
};

let sitemapIdsCache: { ids: number[]; fetchedAt: number } | null = null;

export function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export async function getSrealitySitemapIds(): Promise<number[]> {
  if (sitemapIdsCache && Date.now() - sitemapIdsCache.fetchedAt < SITEMAP_TTL_MS) {
    return sitemapIdsCache.ids;
  }

  const ids = new Set<number>();
  for (const part of SITEMAP_PARTS) {
    const url = `https://www.sreality.cz/${part}.xml.gz`;
    try {
      const res = await globalThis.fetch(url, {
        headers: SREALITY_SITEMAP_HEADERS,
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const ds = new DecompressionStream("gzip");
      const text = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
      const re = /\/detail\/prodej\/byt\/[^\s"<>]+?\/(\d{6,})\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        ids.add(parseInt(m[1], 10));
      }
    } catch {
      // skip failed part
    }
  }

  sitemapIdsCache = { ids: [...ids], fetchedAt: Date.now() };
  return sitemapIdsCache.ids;
}

export function pickSrealitySampleIds(seedStr: string, targetCount: number): number[] {
  const ids = sitemapIdsCache?.ids;
  if (!ids || ids.length === 0) return [];
  const count = Math.min(targetCount, ids.length);
  const seed = hashString(seedStr);
  const step = Math.max(1, Math.floor(ids.length / count));
  const out: number[] = [];
  for (let i = seed % step; i < ids.length && out.length < count; i += step) {
    out.push(ids[i]);
  }
  return out;
}

export function clearSitemapCache(): void {
  sitemapIdsCache = null;
}
