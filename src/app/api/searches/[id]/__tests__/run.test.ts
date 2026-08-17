import { describe, it, expect, vi } from "vitest";
import { POST } from "../run/route";

vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "user-1" } }),
}));

const crawlSearch = vi.fn();
vi.mock("@/lib/scraping/orchestrator-setup", () => ({
  createScrapingOrchestrator: async () => ({ crawlSearch }),
}));

let existingSearch: Record<string, unknown> | null = null;
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            then: async (cb: (r: Record<string, unknown>[]) => unknown) => cb(existingSearch ? [existingSearch] : []),
          }),
        }),
      }),
    }),
  },
}));

describe("POST /api/searches/[id]/run — SSE skenování jednoho hledání", () => {
  it("streamuje progress události portálů a done", async () => {
    existingSearch = {
      id: "s1",
      userId: "user-1",
      name: "Cheb byty",
      filters: JSON.stringify({ location: "Cheb" }),
      schedule: "manual",
    };
    crawlSearch.mockImplementation(
      async (_id: string, _filters: unknown, opts?: { onPortalProgress?: (p: string, f: number, e: string[]) => void }) => {
        opts?.onPortalProgress?.("sreality", 4, []);
        opts?.onPortalProgress?.("bazos", 1, ["Crawl error (bazos): timeout"]);
        return { total: 5, errors: ["Crawl error (bazos): timeout"] };
      }
    );

    const res = await POST(new Request("http://localhost/api/searches/s1/run"), {
      params: Promise.resolve({ id: "s1" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await new Response(res.body).text();
    expect(text).toContain("event: progress");
    expect(text).toContain('"searchName":"Cheb byty"');
    expect(text).toContain('"portal":"sreality"');
    expect(text).toContain("event: done");
    expect(text).toContain('"total":5');
  });

  it("vrátí 404 pro neexistující hledání", async () => {
    existingSearch = null;
    const res = await POST(new Request("http://localhost/api/searches/nope/run"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });
});
