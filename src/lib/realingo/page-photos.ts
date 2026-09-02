/**
 * Fotky z veřejné HTML stránky nabídky.
 *
 * GraphQL `searchOffer` u locked/předstih nabídek fotky nevrací vůbec
 * (`photos: null`), přestože je veřejná stránka nabídky renderuje celé
 * (SSR `<picture>` + og:image). Extractor pracuje jen s řetězci, aby šel
 * testovat bez sítě; `fetchRealingoPagePhotos` přidává HTTP.
 */

const OFFER_PHOTO_RE =
  /(?:https:\/\/www\.realingo\.cz)?\/static\/images\/offer\/[^"'\s\\?#]+\.(?:jpe?g|png|webp)/gi;

const PAGE_TIMEOUT_MS = 10_000;
const MAX_PHOTOS = 10;

/**
 * Vydedupuje fotky z HTML podle basenameu (webp+jpg = tatéž foto), preferuje
 * .jpg (širší podpora u klientů). Pořadí = první výskyt v HTML = gallery
 * order (náhledový obrázek nahoře).
 */
export function parseRealingoPagePhotos(html: string): string[] {
  const byBase = new Map<string, string>();
  for (const m of html.matchAll(OFFER_PHOTO_RE)) {
    const raw = m[0];
    const name = raw.slice(raw.lastIndexOf("/") + 1);
    const base = name.slice(0, name.lastIndexOf("."));
    const url = raw.startsWith("http") ? raw : `https://www.realingo.cz${raw}`;
    const prev = byBase.get(base);
    if (!prev) byBase.set(base, url);
    else if (/\.(webp)$/i.test(prev) && /\.(jpe?g)$/i.test(name)) byBase.set(base, url);
  }
  return [...byBase.values()]
    .filter((u) => !/placeholder|no-image|default/i.test(u))
    .slice(0, MAX_PHOTOS);
}

/** Stáhne veřejnou stránku nabídky a vrátí její fotky (prázdné při selhání). */
export async function fetchRealingoPagePhotos(url: string): Promise<string[]> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Realingo page -> HTTP ${res.status}`);
  return parseRealingoPagePhotos(await res.text());
}
