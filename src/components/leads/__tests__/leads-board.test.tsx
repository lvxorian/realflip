import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LeadsBoard } from "../leads-board";
import type { LeadItem } from "../types";

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

const DAY_MS = 86_400_000;

function makeLead(overrides: Partial<LeadItem> = {}): LeadItem {
  return {
    id: "lead-1",
    dealId: null,
    stage: "offer",
    priority: 0,
    notes: null,
    assignedTo: null,
    stageData: { offer: { amount: 2_100_000, expiresAt: null, items: [] } },
    position: 0,
    stageEnteredAt: Date.now() - DAY_MS,
    lostReason: null,
    nextStep: null,
    nextStepDueAt: null,
    createdAt: Date.now() - DAY_MS,
    updatedAt: Date.now() - 3_600_000,
    propertyId: "prop-1",
    propertyTitle: "Prodej, byt 2+kk",
    propertyPrice: 2_500_000,
    propertyPricePerSqm: 51_000,
    propertyFirstSeen: Date.now() - 10 * DAY_MS - 3_600_000,
    propertyArea: 49,
    propertyRooms: "2+kk",
    propertyAddress: "Poděbradova 2842/1, Jižní Předměstí",
    propertyCondition: null,
    propertyBuildingType: null,
    propertyYearBuilt: null,
    propertyPortalName: "sreality",
    propertyUrl: null,
    propertyImageUrl: null,
    propertyImageUrls: [],
    propertyRemoved: false,
    propertyIsActive: true,
    propertyRemovedAt: null,
    contactId: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    analysisScore: 70,
    analysisArv: 3_500_000,
    analysisTargetPurchasePrice: 2_000_000,
    portalStatus: null,
    portalReservedInvestorId: null,
    portalReservedModel: null,
    portalReservedStrategy: null,
    portalExpiresAt: null,
    ...overrides,
  };
}

function mockFetch(leads: LeadItem[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/investors") {
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url === "/api/leads" && method === "GET") {
      return new Response(JSON.stringify(leads), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.startsWith("/api/leads/") && method === "PATCH") {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.startsWith("/api/leads/") && method === "GET") {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected " + url }), { status: 500, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("LeadsBoard — přesun do Vyjednáno s potvrzením ceny", () => {
  it("po zadání ceny a kliknutí na ✓ odešle PATCH se stage negotiation a stageData", async () => {
    const fetchMock = mockFetch([makeLead()]);
    render(<LeadsBoard />);

    // Karta se načte
    await screen.findByText("Prodej, byt 2+kk");

    // Rychlý posun o fázi dál (→) → do Vyjednáno bez ceny → prompt na kartě
    const advance = screen.getByTitle("Posunout do další fáze");
    fireEvent.click(advance);

    // Prompt se zobrazí rovnou se vstupem pro cenu
    const input = await screen.findByPlaceholderText("2000000");
    fireEvent.change(input, { target: { value: "1950000" } });

    // Potvrzení zelenou fajfkou
    fireEvent.click(screen.getByText("✓"));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patch).toBeTruthy();
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    const body = JSON.parse(String(patchCall[1]?.body));
    expect(body.stage).toBe("negotiation");
    expect(body.stageData.negotiation.currentAmount).toBe(1950000);
    expect(body.stageData.negotiation.history[0]).toMatchObject({ price: 1950000, by: "them" });
  });

  it("česky formátovaná cena s mezerami se odešle jako číslo 2500000", async () => {
    const fetchMock = mockFetch([makeLead()]);
    render(<LeadsBoard />);

    await screen.findByText("Prodej, byt 2+kk");
    fireEvent.click(screen.getByTitle("Posunout do další fáze"));

    const input = await screen.findByPlaceholderText("2000000");
    fireEvent.change(input, { target: { value: "2 500 000" } });
    fireEvent.click(screen.getByText("✓"));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patch).toBeTruthy();
    });

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    const body = JSON.parse(String(patchCall[1]?.body));
    expect(body.stage).toBe("negotiation");
    expect(body.stageData.negotiation.currentAmount).toBe(2500000);
  });
});
