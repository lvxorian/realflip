import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../ai-analysis/route";

vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/ai/analyzer", () => ({
  analyzeListing: async () => ({
    summary: "Silný investiční kandidát v dobré lokalitě.",
    sentiment: "urgent",
    maxBid: 2500000,
    negotiationTips: ["Poukázat na starou koupelnu."],
    redFlags: ["Popis je krátký."],
    hiddenInfo: ["Ověřit platnost energetického štítku."],
    comparableNotes: "V lokalitě se prodává za 3,1–3,4 mil. Kč.",
  }),
}));

let property: Record<string, unknown> | null = null;
let analysisRow: Record<string, unknown> | null = null;
const updateSet = vi.fn();
const updateWhere = vi.fn();
const insertValues = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (cols?: Record<string, unknown>) => ({
      from: (table: { propertyId?: unknown; id?: unknown }) => {
        const isProperty = !table.propertyId; // properties tabulka nemá propertyId
        return {
          where: () => ({
            limit: () => ({
              then: async (cb: (r: Record<string, unknown>[]) => unknown) =>
                cb(isProperty ? (property ? [property] : []) : analysisRow ? [analysisRow] : []),
            }),
          }),
        };
      },
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        updateSet(...args);
        return { where: updateWhere };
      },
    }),
    insert: () => ({
      values: (...args: unknown[]) => {
        insertValues(...args);
        return { then: async () => undefined };
      },
    }),
  },
}));

describe("POST /api/properties/[id]/ai-analysis — on-demand AI hodnocení", () => {
  beforeEach(() => {
    property = {
      id: "p1",
      title: "Byt 3+1 Cheb",
      price: 2800000,
      pricePerSqm: 40000,
      area: 70,
      rooms: "3+1",
      address: "Cheb",
      condition: "good",
      description: "Prostorný byt v centru.",
    };
    analysisRow = { id: "a1", propertyId: "p1" };
    updateSet.mockClear();
    updateWhere.mockClear();
    insertValues.mockClear();
  });

  it("vygeneruje AI hodnocení a uloží ho do property_analysis", async () => {
    const res = await POST(new Request("http://localhost/api/properties/p1/ai-analysis"), {
      params: Promise.resolve({ id: "p1" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.summary).toContain("Silný investiční kandidát");
    expect(data.maxBid).toBe(2500000);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ aiReport: expect.any(String) }));
    expect(updateWhere).toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("vrátí 404 pro neexistující nemovitost", async () => {
    property = null;
    const res = await POST(new Request("http://localhost/api/properties/nope/ai-analysis"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });
});
