import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../rate-limiter", () => ({
  RateLimiter: {
    getInstance: () => ({
      wait: async () => {},
    }),
  },
}));

import { BazosAdapter } from "../adapters/bazos";

describe("BazosAdapter pagination", () => {
  const fetchedUrls: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    fetchedUrls.length = 0;
  });

  it("používá offset paginaci (20/40/...) místo strana/", async () => {
    // Stránka bez inzerátů → crawl se zastaví, ale zachytíme URL
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchedUrls.push(url);
      return new Response("<html><body>prázdno</body></html>", { status: 200 });
    });

    const adapter = new BazosAdapter();
    await adapter.crawlListings({});

    expect(fetchedUrls).toHaveLength(1);
    expect(fetchedUrls[0]).toBe("https://reality.bazos.cz/prodam/byt/");
  });

  it("druhá stránka = offset 20", async () => {
    const page1 = `
      <html><body>
        <div class="inzeraty inzeratyflex">
          <h2 class="nadpis"><a href="/inzerat/1/test.php">Prodej bytu 2+1 Praha</a></h2>
          <div class="inzeratycena"><b>4 000 000 Kč</b></div>
          <div class="inzeratylok">Praha</div>
          <img class="obrazek" src="/img/x.jpg">
          <div class="popis">Byt</div>
        </div>
        <div class="inzeraty inzeratyflex">
          <h2 class="nadpis"><a href="/inzerat/2/test2.php">Prodej bytu 1+kk Brno</a></h2>
          <div class="inzeratycena"><b>3 000 000 Kč</b></div>
          <div class="inzeratylok">Brno</div>
          <img class="obrazek" src="/img/y.jpg">
          <div class="popis">Byt</div>
        </div>
      </body></html>`;
    const empty = "<html><body>prázdno</body></html>";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchedUrls.push(url);
      const body = url.includes("20/") ? empty : page1;
      return new Response(body, { status: 200 });
    });

    const adapter = new BazosAdapter();
    const listings = await adapter.crawlListings({});

    // 1. stránka má 2 inzeráty, 2. stránka (offset 20) je prázdná → zastaví se
    expect(fetchedUrls[0]).toBe("https://reality.bazos.cz/prodam/byt/");
    expect(fetchedUrls[1]).toBe("https://reality.bazos.cz/prodam/byt/20/");
    expect(listings).toHaveLength(2);
  });
});
