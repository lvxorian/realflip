import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BulkSearchLog } from "../bulk-search-log";

beforeAll(() => {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error test stub
  globalThis.IntersectionObserver = IO;
  globalThis.ResizeObserver = IO;
  (window as { matchMedia?: unknown }).matchMedia =
    (window as { matchMedia?: unknown }).matchMedia ??
    (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function sseResponse(events: { event: string; data: unknown }[]): Response {
  const body = events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const baseEvents = (): { event: string; data: unknown }[] => [
  { event: "progress", data: { kind: "search-start", searchId: "s1", searchName: "Praha byty", index: 0, total: 1 } },
  { event: "progress", data: { kind: "portal", searchId: "s1", searchName: "Praha byty", portal: "sreality", found: 3, errors: [] } },
  { event: "progress", data: { kind: "portal", searchId: "s1", searchName: "Praha byty", portal: "bezrealitky", found: 2, errors: [] } },
  { event: "progress", data: { kind: "search-done", searchId: "s1", searchName: "Praha byty", total: 5, errors: [] } },
];

describe("BulkSearchLog — live log hromadného hledání", () => {
  it("zobrazí živý progress a po done události shrnutí", async () => {
    const fetchMock = vi.fn(async () => sseResponse([...baseEvents(), { event: "done", data: { total: 5, runCount: 1, failed: [] } }]));
    vi.stubGlobal("fetch", fetchMock);
    const onFinished = vi.fn();

    render(<BulkSearchLog open onClose={() => {}} onFinished={onFinished} />);

    // Progress hledání
    expect(await screen.findByText("Dokončeno 1 z 1 hledání")).toBeTruthy();
    expect(screen.getByText("+5 inzerátů")).toBeTruthy();
    // Portálové chipy s počty
    expect(screen.getByText("Sreality 3")).toBeTruthy();
    expect(screen.getByText("BezRealitky 2")).toBeTruthy();
    // Shrnutí (text je rozbitý do vnořených spanů — matcher přes textContent)
    await waitFor(() => {
      expect(
        screen.getAllByText((_content, el) => el?.textContent?.includes("5 inzerátů napříč 1 hledáními") ?? false).length
      ).toBeGreaterThan(0);
    });
    expect(screen.getByText("Dokončeno")).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledWith("/api/searches/run-all", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it("označí běh jako přerušený, když stream skončí bez done i po auto-pokusech (limit serveru)", async () => {
    // Bez done události — server běh přerušil. Auto-pokračování zkusí
    // dojet zbývající hledání, a když to nejde ani po vyčerpání pokusů,
    // ukáže finální „Přerušeno" (v testu jen 1 pokus, bez pauzy).
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(baseEvents())));
    const onFinished = vi.fn();

    render(<BulkSearchLog open onClose={() => {}} onFinished={onFinished} maxRetries={1} retryDelayMs={0} />);

    await screen.findByText("Praha byty");
    expect(await screen.findByText("Přerušeno")).toBeTruthy();
    expect(screen.getByText(/limit 60 s/)).toBeTruthy();
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it("při přerušení automaticky spustí další běh a dojede zbývající hledání", async () => {
    // 1. běh: hledání s1 proběhne, s2 se nestihne → stream skončí bez done.
    // 2. běh: server dostane skipSearchIds=[s1] a dojede jen s2.
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => sseResponse([
        { event: "progress", data: { kind: "search-start", searchId: "s1", searchName: "Praha byty", index: 0, total: 2 } },
        { event: "progress", data: { kind: "search-done", searchId: "s1", searchName: "Praha byty", total: 5, errors: [] } },
      ]))
      .mockImplementationOnce(async () => sseResponse([
        { event: "progress", data: { kind: "search-start", searchId: "s2", searchName: "Brno domy", index: 1, total: 2 } },
        { event: "progress", data: { kind: "search-done", searchId: "s2", searchName: "Brno domy", total: 3, errors: [] } },
        { event: "done", data: { total: 3, runCount: 1, failed: [] } },
      ]));
    vi.stubGlobal("fetch", fetchMock);
    const onFinished = vi.fn();

    render(<BulkSearchLog open onClose={() => {}} onFinished={onFinished} maxRetries={3} retryDelayMs={0} />);

    // Oba běhy proběhnou automaticky bez zásahu uživatele
    expect(await screen.findByText("Brno domy")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Dokončeno")).toBeTruthy());

    // Druhý běh poslal serveru jen zbývající hledání (s1 přeskočeno)
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(bodies[0].skipSearchIds).toEqual([]);
    expect(bodies[1].skipSearchIds).toEqual(["s1"]);
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
  });

  it("zobrazí chybu portálu červeně", async () => {
    const events = [
      { event: "progress", data: { kind: "search-start", searchId: "s1", searchName: "Brno", index: 0, total: 1 } },
      { event: "progress", data: { kind: "portal", searchId: "s1", searchName: "Brno", portal: "bazos", found: 0, errors: ["Crawl error (bazos): timeout"] } },
      { event: "progress", data: { kind: "search-done", searchId: "s1", searchName: "Brno", total: 0, errors: ["Crawl error (bazos): timeout"] } },
      { event: "done", data: { total: 0, runCount: 1, failed: [] } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(events)));

    render(<BulkSearchLog open onClose={() => {}} onFinished={() => {}} />);

    await screen.findByText("Brno");
    // Chyba portálu se ukáže v počtu chyb hledání
    expect(screen.getByText("1 chyb")).toBeTruthy();
    // Chip bazos je v chybovém stavu
    expect(screen.getByText("Bazos")).toBeTruthy();
  });
});
