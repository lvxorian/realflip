import { RawListing, PortalConfig, PORTAL_CONFIGS, PortalName, SearchFilters } from "../types";
import { RateLimiter } from "../rate-limiter";

export abstract class PortalAdapter {
  protected config: PortalConfig;
  protected rateLimiter: RateLimiter;

  /**
   * URL inzerátů, které už máme v DB — pro ně se při bulk crawlu přeskočí
   * drahý detail fetch (popis/fotky už známe, list stránka stačí na aktualizaci
   * ceny a prodejnosti). Nastavuje orchestrator před hromadným hledáním.
   */
  public skipDetailForUrls: Set<string> | null = null;

  constructor(portalName: PortalName) {
    this.config = PORTAL_CONFIGS[portalName];
    this.rateLimiter = RateLimiter.getInstance();
  }

  /** Má se pro tento inzerát vynechat detail fetch? (známý z DB) */
  protected shouldSkipDetail(url: string): boolean {
    return this.skipDetailForUrls?.has(url) ?? false;
  }

  /**
   * Enrichne dávky s omezenou konkurencí. Pro inzeráty už známé z DB
   * (skipDetailForUrls) detail fetch vynechá úplně — list data stačí.
   * Nahrazuje neomezené `Promise.all(all.map(enrich))`, které zasypávalo
   * portály požadavky (429) a znemožňovalo dokončit běh v limitu 60 s.
   */
  protected async enrichBatch<T extends RawListing>(
    listings: T[],
    enrich: (l: T) => Promise<T>,
    concurrency = 3
  ): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < listings.length; i += concurrency) {
      const batch = listings.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((l) => (this.shouldSkipDetail(l.url) ? l : enrich(l).catch(() => l)))
      );
      out.push(...results);
    }
    return out;
  }

  abstract crawlListings(filters?: SearchFilters): Promise<RawListing[]>;
  async crawlCityListings?(cityKey: string, limit?: number): Promise<RawListing[]>;
  abstract extractContact(html: string): { phone: string | null; name: string | null; email: string | null };

  protected async fetch(url: string): Promise<string> {
    await this.rateLimiter.wait(this.config.name);

    const headers: Record<string, string> = {
      "User-Agent": this.getRandomUserAgent(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "cs,en;q=0.9,sk;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    };

    const response = await fetch(url, { headers });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.fetch(url);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }

    return response.text();
  }

  protected extractPrice(text: string): number | null {
    const match = text.match(/(\d[\s\d]*)\s*(Kč|CZK|,-|\.-)/i);
    if (!match) return null;
    return parseInt(match[1].replace(/\s/g, ""));
  }

  protected extractArea(text: string): number | null {
    const match = text.match(/(\d+[,.]?\d*)\s*m[²2]/i);
    if (!match) return null;
    return parseFloat(match[1].replace(",", "."));
  }

  protected extractRooms(text: string): string | null {
    const patterns = [
      /(\d+\+[a-z]{2})/i,
      /(\d+\+1)/i,
      /(\d+)\s*\(\s*(\d+)\s*\+\s*(\d+)\s*\)/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  protected getRandomUserAgent(): string {
    const agents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  protected cleanText(text: string | null): string | null {
    if (!text) return null;
    return text.replace(/\s+/g, " ").trim();
  }
}
