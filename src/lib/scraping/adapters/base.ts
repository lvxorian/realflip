import { RawListing, PortalConfig, PORTAL_CONFIGS, PortalName, SearchFilters } from "../types";
import { RateLimiter } from "../rate-limiter";

/**
 * Kontext krokového crawlu (auto-pokračování po limitu 60 s).
 * Kroky = stránky (0..maxPages-1). startStep = počet stránek dokončených
 * v předchozích bězích — přeskočí se. Deadline zastaví začínání nových kroků.
 */
export interface CrawlStep {
  /** Kroky dokončené v předchozích bězích — přeskočí se. */
  startStep: number;
  /** Časový strop (epoch ms) — po vypršení se nezačínají nové kroky. */
  deadlineMs: number | null;
  /** Hlásí dokončení kroku (orchestrátor persistuje progress do DB). */
  onStepDone: (step: number) => void;
  /** Adaptér nastaví na false, když skončil předčasně (deadline) — běh je neúplný. */
  completed: boolean;
}

export abstract class PortalAdapter {
  protected config: PortalConfig;
  protected rateLimiter: RateLimiter;

  /**
   * URL inzerátů, které už máme v DB — pro ně se při bulk crawlu přeskočí
   * drahý detail fetch (popis/fotky už známe, list stránka stačí na aktualizaci
   * ceny a prodejnosti). Nastavuje orchestrator před hromadným hledáním.
   */
  public skipDetailForUrls: Set<string> | null = null;

  /** Volitelně: adaptér si může z URL známých inzerátů odvodit vlastní index
   *  (např. sreality si parsuje hash ID pro městský crawl). */
  public setKnownUrls?(urls: Set<string>): void;

  constructor(portalName: PortalName) {
    this.config = PORTAL_CONFIGS[portalName];
    this.rateLimiter = RateLimiter.getInstance();
  }

  /** Má se pro tento inzerát vynechat detail fetch? (známý z DB) */
  protected shouldSkipDetail(url: string): boolean {
    return this.skipDetailForUrls?.has(url) ?? false;
  }

  /**
   * Stránkovací smyčka s přeskočením dokončených stránek a časovým stropem.
   * `crawlPage(page)` vrací počet nalezených položek (0 = konec výsledků).
   * Bez `ctx` se chová jako obyčejná smyčka 1..maxPages (jednotlivé hledání).
   */
  protected async forPages(
    ctx: CrawlStep | undefined,
    maxPages: number,
    crawlPage: (page: number) => Promise<number>,
  ): Promise<void> {
    for (let page = 1; page <= maxPages; page++) {
      const step = page - 1;
      if (ctx && step < ctx.startStep) continue;
      if (ctx?.deadlineMs != null && Date.now() >= ctx.deadlineMs) {
        ctx.completed = false;
        return;
      }
      const count = await crawlPage(page);
      ctx?.onStepDone(step);
      if (count === 0) return;
    }
  }

  /**
   * Enrichne dávky s omezenou konkurencí. Pro inzeráty už známé z DB
   * (skipDetailForUrls) detail fetch vynechá úplně — list data stačí.
   * S `ctx` se každá dávka kontroluje proti deadline (běh musí skončit
   * v limitu 60 s; nedokončený portál se dojede příštím během).
   */
  protected async enrichBatch<T extends RawListing>(
    listings: T[],
    enrich: (l: T) => Promise<T>,
    concurrency = 3,
    ctx?: CrawlStep,
  ): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < listings.length; i += concurrency) {
      if (ctx?.deadlineMs != null && Date.now() >= ctx.deadlineMs) {
        ctx.completed = false;
        // Už nacrawlené list inzeráty nesmíme zahodit — uloží se bez detail
        // fetchů (známé z DB se stejně přeskočí), zbytek dojede příští běh.
        out.push(...listings.slice(i));
        return out;
      }
      const batch = listings.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((l) => (this.shouldSkipDetail(l.url) ? l : enrich(l).catch(() => l)))
      );
      out.push(...results);
    }
    return out;
  }

  abstract crawlListings(filters?: SearchFilters, ctx?: CrawlStep): Promise<RawListing[]>;
  async crawlCityListings?(cityKey: string, limit?: number, ctx?: CrawlStep): Promise<RawListing[]>;
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

    const response = await fetch(url, {
      headers,
      // Zaseknutý požadavek nesmí zabít celý běh — server Vercel běh ukončí
      // v 60 s, takže každý request dostane tvrdý strop.
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429) {
      // Rate limit — počkáme krátce a zkusíme jednou znovu. Víc se nevyplatí:
      // každé čekání žere budget 60 s běhu, portál se nechá dojet příštím během.
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = Math.min(retryAfter ? parseInt(retryAfter) * 1000 : 10000, 10000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      const retry = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (retry.ok) return retry.text();
      if (retry.status === 429) throw new Error(`HTTP 429 (rate limit): ${url}`);
      throw new Error(`HTTP ${retry.status}: ${url}`);
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
