import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => ({ then: vi.fn() })) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ set: vi.fn() })) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  },
}));

import { discoverLatestCrimeSource } from "../locality/crime";

function fakeResponse(html: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 404,
    arrayBuffer: () => Promise.resolve(Buffer.from(html, "utf8")),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("discoverLatestCrimeSource", () => {
  it("najde nejnovější měsíc na stránce aktuálního roku", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(`
      <div class="related">
        <a href="soubor/2026-02-unor-sest-01a-xlsx.aspx">2026_02_Unor_sest_01a.xlsx</a>
        <a href="soubor/2026-03-brezen-sest-01a-xlsx.aspx">2026_03_Brezen_sest_01a.xlsx</a>
        <a href="soubor/2026-06-cerven-sest-01a-xlsx.aspx">2026_06_Cerven_sest_01a.xlsx</a>
      </div>
    `)));

    const result = await discoverLatestCrimeSource();
    expect(result.period).toBe("2026-06");
    expect(result.url).toBe("https://www.policie.cz/soubor/2026-06-cerven-sest-01a-xlsx.aspx");
  });

  it("sestoupí do staršího roku, pokud aktuální rok nemá soubory", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse("<html>bez souboru</html>"))
      .mockResolvedValueOnce(fakeResponse(`
        <div class="related">
          <a href="soubor/2025-12-prosinec-sest-01a-xlsx.aspx">2025_12_Prosinec_sest_01a.xlsx</a>
        </div>
      `));
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverLatestCrimeSource();
    expect(result.period).toBe("2025-12");
    expect(result.url).toBe("https://www.policie.cz/soubor/2025-12-prosinec-sest-01a-xlsx.aspx");
  });

  it("fallback na poslední známou statiku, když nic nenajde", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse("<html>nic</html>")));

    const result = await discoverLatestCrimeSource();
    expect(result.period).toBe("2025-12");
  });
});
