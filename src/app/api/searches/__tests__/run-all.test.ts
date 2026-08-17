import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../run-all/route";

vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "user-1" } }),
}));

const crawlAllForUser = vi.fn();

vi.mock("@/lib/scraping/orchestrator-setup", () => ({
  createScrapingOrchestrator: async () => ({ crawlAllForUser }),
}));

async function readStreamText(res: Response): Promise<string> {
  return new Response(res.body).text();
}

describe("POST /api/searches/run-all — SSE streaming hromadného hledání", () => {
  beforeEach(() => {
    crawlAllForUser.mockReset();
    crawlAllForUser.mockImplementation(
      async (_userId: string, opts?: { onProgress?: (ev: unknown) => void }) => {
        opts?.onProgress?.({
          kind: "search-start",
          searchId: "s1",
          searchName: "Praha byty",
          index: 0,
          total: 1,
        });
        opts?.onProgress?.({
          kind: "portal",
          searchId: "s1",
          searchName: "Praha byty",
          portal: "sreality",
          found: 3,
          errors: [],
        });
        opts?.onProgress?.({
          kind: "search-done",
          searchId: "s1",
          searchName: "Praha byty",
          total: 3,
          errors: [],
        });
        return { total: 3, runCount: 1, failed: [] };
      }
    );
  });

  it("vrací SSE stream s progress událostmi a dokončovací událostí done", async () => {
    const res = await POST(new Request("http://localhost/api/searches/run-all", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await readStreamText(res);
    expect(text).toContain("event: progress");
    expect(text).toContain('"kind":"search-start"');
    expect(text).toContain('"searchName":"Praha byty"');
    expect(text).toContain('"portal":"sreality"');
    expect(text).toContain("event: done");
    expect(text).toContain('"total":3');
  });

  it("pošle error událost, když crawl vyhodí výjimku", async () => {
    crawlAllForUser.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(new Request("http://localhost/api/searches/run-all", { method: "POST" }));
    const text = await readStreamText(res);
    expect(text).toContain("event: error");
    expect(text).toContain("boom");
  });

  it("předá skipSearchIds z body orchestratoru (auto-pokračování po limitu)", async () => {
    crawlAllForUser.mockImplementation(async (_userId: string, opts?: { skipSearchIds?: string[] }) => {
      return { total: 0, runCount: 0, failed: [], skip: opts?.skipSearchIds };
    });
    const res = await POST(
      new Request("http://localhost/api/searches/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipSearchIds: ["s1", "s2"] }),
      })
    );
    const text = await readStreamText(res);
    expect(text).toContain("event: done");
    expect(crawlAllForUser).toHaveBeenCalledWith("user-1", expect.objectContaining({ skipSearchIds: ["s1", "s2"] }));
  });

  it("předá skipPortals z body orchestratoru (auto-pokračování na úrovni portálů)", async () => {
    crawlAllForUser.mockImplementation(async (_userId: string, opts?: { skipPortals?: Record<string, string[]> }) => {
      return { total: 0, runCount: 0, failed: [], skip: opts?.skipPortals };
    });
    const res = await POST(
      new Request("http://localhost/api/searches/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipPortals: { s1: ["sreality", "bazos"] } }),
      })
    );
    const text = await readStreamText(res);
    expect(text).toContain("event: done");
    expect(crawlAllForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ skipPortals: { s1: ["sreality", "bazos"] } })
    );
  });
});
