import { describe, it, expect } from "vitest";
import { parseStageData, offerPriceOf, toPortalView, type PortalRow } from "@/lib/investor-portal-view";

const row = (over: Partial<PortalRow> = {}): PortalRow => ({
  leadId: "lead-1",
  portalStatus: "available",
  reservedById: null,
  reservedByName: null,
  district: "Žižkov",
  city: "Praha",
  condition: "original",
  area: 74,
  rooms: "3+1",
  floor: 2,
  originalPrice: 4_990_000,
  stageData: null,
  arv: 5_200_000,
  renovationCost: 700_000,
  monthlyRent: 18_000,
  locationCategory: null,
  calcMode: "flip",
  netProfit: null,
  roi: null,
  annualizedRoi: null,
  cashOnCash: null,
  rentalYield: null,
  cashFlowMonthly: null,
  calcSnapshot: null,
  ...over,
});

describe("parseStageData", () => {
  it("parses JSON string with negotiation stage", () => {
    const sd = parseStageData('{"negotiation":{"currentAmount":3500000,"history":[{"price":3600000,"date":"2026-01-01","by":"them"}]}}');
    expect(sd?.negotiation?.currentAmount).toBe(3500000);
  });

  it("returns null for invalid JSON", () => {
    expect(parseStageData("{broken")).toBeNull();
  });

  it("returns null for empty", () => {
    expect(parseStageData(null)).toBeNull();
    expect(parseStageData("")).toBeNull();
  });
});

describe("offerPriceOf", () => {
  it("prefers negotiation currentAmount over offer amount", () => {
    const sd = {
      negotiation: { currentAmount: 3_200_000 },
      offer: { amount: 3_000_000, expiresAt: null },
    };
    expect(offerPriceOf(sd)).toBe(3_200_000);
  });

  it("falls back to offer amount", () => {
    expect(offerPriceOf({ offer: { amount: 3_000_000, expiresAt: null } })).toBe(3_000_000);
  });

  it("returns null when nothing matches", () => {
    expect(offerPriceOf(null)).toBeNull();
    expect(offerPriceOf({ negotiation: { currentAmount: null } })).toBeNull();
  });
});

describe("toPortalView", () => {
  it("whitelists fields — no address, photos, url or contact leak", () => {
    const view = toPortalView(row(), "inv-1", { budget: 5_000_000, unlimited: false });
    expect(view).not.toHaveProperty("address");
    expect(view).not.toHaveProperty("imageUrls");
    expect(view).not.toHaveProperty("url");
    expect(view).not.toHaveProperty("lat");
    expect(view).not.toHaveProperty("lng");
    expect(view).not.toHaveProperty("contactPhone");
    expect(view.district).toBe("Žižkov");
    expect(view.city).toBe("Praha");
    expect(view.condition).toBe("Před rekonstrukcí");
    expect(view.offerPrice).toBe(4_990_000);
  });

  it("uses negotiated amount as offer price instead of target", () => {
    const view = toPortalView(
      row({ stageData: JSON.stringify({ negotiation: { currentAmount: 3_200_000 } }) }),
      "inv-1",
      { budget: 5_000_000, unlimited: false }
    );
    expect(view.offerPrice).toBe(3_200_000);
    const expectedSavings = Math.round(((4_990_000 - 3_200_000) / 4_990_000) * 1000) / 10;
    expect(view.savingsPct).toBe(expectedSavings);
  });

  it("flags over-budget when offer exceeds investor budget", () => {
    const ok = toPortalView(row(), "inv-1", { budget: 5_000_000, unlimited: false });
    const over = toPortalView(
      row({ stageData: JSON.stringify({ negotiation: { currentAmount: 5_400_000 } }) }),
      "inv-1",
      { budget: 5_000_000, unlimited: false }
    );
    expect(ok.overBudget).toBe(false);
    expect(over.overBudget).toBe(true);
  });

  it("never flags over-budget for unlimited investor", () => {
    const over = toPortalView(
      row({ stageData: JSON.stringify({ negotiation: { currentAmount: 50_000_000 } }) }),
      "inv-1",
      { budget: null, unlimited: true }
    );
    expect(over.overBudget).toBe(false);
  });

  it("marks reservation as mine vs other", () => {
    const mine = toPortalView(row({ portalStatus: "reserved", reservedById: "inv-9", reservedByName: "Petr" }), "inv-9", { budget: null, unlimited: true });
    const other = toPortalView(row({ portalStatus: "reserved", reservedById: "inv-2", reservedByName: "Petr" }), "inv-9", { budget: null, unlimited: true });
    expect(mine.reservedByMe).toBe(true);
    expect(mine.status).toBe("reserved");
    expect(other.reservedByMe).toBe(false);
    expect(other.reservedByName).toBe("P.");
  });

  it("anonymizes reserved-by name to initials for other investors", () => {
    const ctx = { budget: null, unlimited: true };
    const balc = toPortalView(row({ portalStatus: "reserved", reservedById: "inv-2", reservedByName: "Galja Sabrieva" }), "inv-9", ctx);
    expect(balc.reservedByName).toBe("G.S.");
    const multi = toPortalView(row({ portalStatus: "reserved", reservedById: "inv-2", reservedByName: "Jan Novák Kubík" }), "inv-9", ctx);
    expect(multi.reservedByName).toBe("J.K.");
    const noName = toPortalView(row({ portalStatus: "reserved", reservedById: "inv-2", reservedByName: null }), "inv-9", ctx);
    expect(noName.reservedByName).toBeNull();
  });

  it("maps condition label for all values", () => {
    const ctx = { budget: null, unlimited: true };
    expect(toPortalView(row({ condition: "new" }), "inv", ctx).condition).toBe("Novostavba");
    expect(toPortalView(row({ condition: "renovated" }), "inv", ctx).condition).toBe("Po rekonstrukci");
    expect(toPortalView(row({ condition: "dilapidated" }), "inv", ctx).condition).toBe("Neobyvatelný");
    expect(toPortalView(row({ condition: null }), "inv", ctx).condition).toBe("—");
  });

  it("flip mode passes stored snapshot verbatim — no recompute", () => {
    const view = toPortalView(
      row({
        calcMode: "flip",
        netProfit: 820_000,
        roi: 18.4,
        annualizedRoi: 36.8,
        arv: 5_200_000,
        calcSnapshot: JSON.stringify({
          mode: "flip",
          purchasePriceUsed: 4_990_000,
          arv: 5_200_000,
          renovationCost: 700_000,
          netProfit: 820_000,
          roi: 18.4,
          annualizedRoi: 36.8,
          cashOnCash: 16.9,
          totalCost: 4_380_000,
          targetPurchasePrice: 3_900_000,
        }),
      }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.calcMode).toBe("flip");
    expect(view.deal.type).toBe("flip");
    expect(view.snapshot?.mode).toBe("flip");
    if (view.deal.type !== "flip") return;
    expect(view.deal.netProfit).toBe(820_000);
    expect(view.deal.roi).toBe(18.4);
    expect(view.deal.annualizedRoi).toBe(36.8);
    expect(view.deal.cashOnCash).toBe(16.9);
  });

  it("flip falls back to stored columns when snapshot missing", () => {
    const view = toPortalView(
      row({ calcMode: "flip", netProfit: 610_000, roi: 13.2, annualizedRoi: 26.4 }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.deal.type).toBe("flip");
    if (view.deal.type !== "flip") return;
    expect(view.deal.netProfit).toBe(610_000);
    expect(view.deal.roi).toBe(13.2);
  });

  it("rental mode passes stored snapshot verbatim and never fabricates flip metrics", () => {
    const view = toPortalView(
      row({
        calcMode: "rental",
        rentalYield: 4.9,
        cashFlowMonthly: 11_200,
        calcSnapshot: JSON.stringify({
          mode: "rental",
          purchasePriceUsed: 4_990_000,
          monthlyRent: 18_000,
          netYield: 4.9,
          grossYield: 4.3,
          netYieldAfterTax: 4.1,
          capRate: 4.9,
          cashFlowMonthly: 11_200,
          totalInvested: 4_900_000,
          targetPurchasePrice: 4_300_000,
        }),
      }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.calcMode).toBe("rental");
    expect(view.deal.type).toBe("rental");
    if (view.deal.type !== "rental") return;
    expect(view.deal.netYield).toBe(4.9);
    expect(view.deal.cashFlowMonthly).toBe(11_200);
    expect(view.deal).not.toHaveProperty("netProfit");
    expect(view.deal).not.toHaveProperty("roi");
  });

  it("rental falls back to stored yield column when snapshot missing", () => {
    const view = toPortalView(
      row({ calcMode: "rental", rentalYield: 5.4, cashFlowMonthly: 9_800 }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.deal.type).toBe("rental");
    if (view.deal.type !== "rental") return;
    expect(view.deal.netYield).toBe(5.4);
    expect(view.deal.cashFlowMonthly).toBe(9_800);
  });

  it("surfaces deal for sorting by netProfit/netYield", () => {
    const view = toPortalView(
      row({ calcMode: "flip", netProfit: 1_000_000, roi: 20 }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.deal.type).toBe("flip");
    if (view.deal.type !== "flip") return;
    expect(view.deal.netProfit).toBe(1_000_000);
  });
});