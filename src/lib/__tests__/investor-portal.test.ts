import { describe, it, expect } from "vitest";
import {
  parseStageData,
  offerPriceOf,
  toPortalView,
  flipCooperationFromSnapshot,
  negotiationAmountOf,
  shiftFlipAtPrice,
  shiftFlipDealAtPrice,
  recalcFlipAtPrice,
  rentalTotalAcquisitionCost,
  rentalLoanCapped,
  parseCalcSnapshot,
  type PortalRow,
  type CalcSnapshotFlip,
  type CalcSnapshotRental,
  type CooperationView,
  type FlipDealView,
} from "@/lib/investor-portal-view";

const row = (over: Partial<PortalRow> = {}): PortalRow => ({
  leadId: "lead-1",
  portalStatus: "available",
  reservedById: null,
  reservedByName: null,
  district: "Žižkov",
  city: "Praha",
  condition: "original",
  buildingType: null,
  area: 74,
  rooms: "3+1",
  floor: 2,
  originalPrice: 4_990_000,
  imageUrls: null,
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

describe("negotiationAmountOf", () => {
  it("returns the confirmed negotiated amount", () => {
    expect(negotiationAmountOf({ negotiation: { currentAmount: 5_600_000 } })).toBe(5_600_000);
  });

  it("returns null when missing or invalid", () => {
    expect(negotiationAmountOf(null)).toBeNull();
    expect(negotiationAmountOf({})).toBeNull();
    expect(negotiationAmountOf({ negotiation: { currentAmount: null } })).toBeNull();
    expect(negotiationAmountOf({ negotiation: { currentAmount: 0 } })).toBeNull();
  });
});

describe("shiftFlipAtPrice", () => {
  const coop: CooperationView = {
    availableStrategies: ["fifty-fifty", "sourcing-fee"],
    netProfitTotal: 900_000,
    investorProfitFiftyFifty: 450_000,
    investorProfitSourcing: 800_000,
    sourcingFee: 100_000,
    fundingFiftyFifty: 6_000_000,
    fundingSourcing: 6_100_000,
    investorRoiFiftyFifty: 7.5,
    investorRoiSourcing: 13.1,
  };

  it("shifts cooperation profits up when negotiated below snapshot basis", () => {
    const shifted = shiftFlipAtPrice(coop, 5_600_000, 5_655_000);
    expect(shifted.netProfitTotal).toBe(955_000);
    expect(shifted.investorProfitFiftyFifty).toBe(477_500);
    expect(shifted.investorProfitSourcing).toBe(855_000);
    expect(shifted.sourcingFee).toBe(100_000);
    expect(shifted.fundingFiftyFifty).toBe(5_945_000);
    expect(shifted.fundingSourcing).toBe(6_045_000);
    expect(shifted.investorRoiFiftyFifty).toBe(8.0);
    expect(shifted.investorRoiSourcing).toBe(14.1);
    expect(shifted.availableStrategies).toEqual(["fifty-fifty", "sourcing-fee"]);
  });

  it("reduces profits when negotiated above basis", () => {
    const shifted = shiftFlipAtPrice(coop, 5_700_000, 5_655_000);
    expect(shifted.netProfitTotal).toBe(855_000);
    expect(shifted.investorProfitFiftyFifty).toBe(427_500);
    expect(shifted.investorProfitSourcing).toBe(755_000);
    expect(shifted.fundingFiftyFifty).toBe(6_045_000);
    expect(shifted.fundingSourcing).toBe(6_145_000);
    expect(shifted.investorRoiFiftyFifty).toBe(7.1);
    expect(shifted.investorRoiSourcing).toBe(12.3);
  });

  it("keeps verbatim when prices match or basis missing", () => {
    expect(shiftFlipAtPrice(coop, 5_655_000, 5_655_000)).toBe(coop);
    expect(shiftFlipAtPrice(coop, 5_600_000, null)).toBe(coop);
  });
});

describe("shiftFlipDealAtPrice", () => {
  const deal: FlipDealView = {
    type: "flip",
    netProfit: 800_000,
    roi: 13.3,
    annualizedRoi: 21.6,
    arv: 13_700_000,
    cashOnCash: 13.3,
  };
  const snapshot = {
    mode: "flip",
    purchasePriceUsed: 5_655_000,
    totalCost: 6_000_000,
    netProfit: 800_000,
  } as CalcSnapshotFlip;

  it("shifts net profit and recomputes roi at negotiated price", () => {
    const shifted = shiftFlipDealAtPrice(deal, snapshot, 5_600_000);
    expect(shifted.netProfit).toBe(855_000);
    expect(shifted.roi).toBe(14.4);
    expect(shifted.cashOnCash).toBe(14.4);
    expect(shifted.annualizedRoi).toBeGreaterThan(21.6);
  });

  it("keeps deal verbatim when prices match", () => {
    expect(shiftFlipDealAtPrice(deal, snapshot, 5_655_000)).toBe(deal);
  });
});

describe("recalcFlipAtPrice", () => {
  // Položkový snapshot odpovídající reálnému případu: cílová cena 2 596 400,
  // vyjednáno 2 500 000. Daň z příjmu se musí přepočítat ze zisku (ne lineárně).
  const snap: CalcSnapshotFlip = {
    mode: "flip",
    purchasePriceUsed: 2_596_400,
    targetPurchasePrice: 2_596_400,
    arv: 4_562_177,
    renovationCost: 770_000,
    legalFees: 25_000,
    appraisalFee: 0,
    contingency: 77_000,
    holdingCosts: 32_400,
    holdingMonths: 6,
    sellingCommission: 0,
    marketingPhoto: 20_000,
    mortgageCost: 0,
    sourcingFee: 0,
    incomeTax: 218_689,
    totalCost: 3_739_489,
    netProfit: 822_688,
    roi: 22.0,
    annualizedRoi: 44.0,
    cashOnCash: 31.7,
  };

  it("recomputes tax and total cost exactly at the negotiated price", () => {
    const recalc = recalcFlipAtPrice(snap, 2_500_000);
    expect(recalc).not.toBeNull();
    expect(recalc!.totalCost).toBe(3_663_333);
    expect(recalc!.incomeTax).toBe(238_933);
    expect(recalc!.netProfit).toBe(898_844);
    expect(recalc!.roi).toBe(24.5);
  });

  it("keeps verbatim when price unchanged", () => {
    expect(recalcFlipAtPrice(snap, 2_596_400)).toBeNull();
  });

  it("returns null for legacy snapshot without itemized breakdown", () => {
    const legacy = { mode: "flip", purchasePriceUsed: 5_655_000, arv: 13_700_000, totalCost: 6_000_000 } as CalcSnapshotFlip;
    expect(recalcFlipAtPrice(legacy, 5_600_000)).toBeNull();
  });

  it("pct fee se přepočítá na cílovou cenu (regrese F-28)", () => {
    // 5% fee: zmrazená absolutní hodnota z staré ceny by byla 129 820;
    // na 2 500 000 má fee být 125 000
    const pctSnap: CalcSnapshotFlip = {
      ...snap,
      sourcingFee: Math.round(2_596_400 * 0.05),
      sourcingFeeIsPct: true,
      sourcingFeeRate: 5,
    };
    const recalc = recalcFlipAtPrice(pctSnap, 2_500_000);
    expect(recalc).not.toBeNull();
    // subTotal = 2 500 000 + fixed(924 400) + fee(125 000) = 3 549 400
    const fixed = snap.legalFees! + snap.renovationCost! + snap.contingency! + snap.holdingCosts! + snap.marketingPhoto!;
    const gross = snap.arv! - (2_500_000 + fixed + 125_000);
    const tax = Math.round(gross * 0.21);
    expect(recalc!.totalCost).toBe(2_500_000 + fixed + 125_000 + tax);
  });

  it("50/50 basis používá noFee.totalCost (konzistentní daňový základ, F-28ii)", () => {
    const feeSnap: CalcSnapshotFlip = { ...snap, sourcingFee: 100_000 };
    const recalc = recalcFlipAtPrice(feeSnap, 2_500_000)!;
    // fundingFiftyFifty = náklady bez fee s daní z bez-fee zisku
    const fixed = snap.legalFees! + snap.renovationCost! + snap.contingency! + snap.holdingCosts! + snap.marketingPhoto!;
    const noFeeGross = snap.arv! - (2_500_000 + fixed);
    const noFeeTotal = 2_500_000 + fixed + Math.round(noFeeGross * 0.21);
    expect(recalc.fundingFiftyFifty).toBe(noFeeTotal);
    expect(recalc.fundingSourcing).toBeGreaterThan(noFeeTotal);
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
    expect(view.photos).toEqual([]);
  });

  it("parses imageUrls JSON into photos", () => {
    const view = toPortalView(
      row({ imageUrls: '["https://cdn.example.com/a.jpg","https://cdn.example.com/b.jpg"]' }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.photos).toEqual(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]);
  });

  it("photos are empty when imageUrls malformed or missing", () => {
    const ctx = { budget: null, unlimited: true };
    expect(toPortalView(row({ imageUrls: "{broken" }), "inv", ctx).photos).toEqual([]);
    expect(toPortalView(row({ imageUrls: null }), "inv", ctx).photos).toEqual([]);
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

  it("maps city slug to proper display name", () => {
    const ctx = { budget: null, unlimited: true };
    expect(toPortalView(row({ city: "praha" }), "inv", ctx).city).toBe("Praha");
    expect(toPortalView(row({ city: "olomouc" }), "inv", ctx).city).toBe("Olomouc");
    expect(toPortalView(row({ city: "ceske_budejovice" }), "inv", ctx).city).toBe("České Budějovice");
    expect(toPortalView(row({ city: "Praha 5" }), "inv", ctx).city).toBe("Praha 5");
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

  it("maps building type label for all values", () => {
    const ctx = { budget: null, unlimited: true };
    expect(toPortalView(row({ buildingType: "brick" }), "inv", ctx).buildingType).toBe("Cihla");
    expect(toPortalView(row({ buildingType: "panel" }), "inv", ctx).buildingType).toBe("Panel");
    expect(toPortalView(row({ buildingType: "new" }), "inv", ctx).buildingType).toBe("Novostavba");
    expect(toPortalView(row({ buildingType: "mixed" }), "inv", ctx).buildingType).toBe("Smíšená");
    expect(toPortalView(row({ buildingType: null }), "inv", ctx).buildingType).toBe("—");
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

  it("cooperation is null for rental and for flip without snapshot", () => {
    const ctx = { budget: null, unlimited: true };
    expect(toPortalView(row({ calcMode: "rental" }), "inv", ctx).cooperation).toBeNull();
    expect(toPortalView(row({ calcMode: "flip" }), "inv", ctx).cooperation).toBeNull();
  });

  it("cooperation reads 50/50 and sourcing numbers from snapshot block (verbatim)", () => {
    const view = toPortalView(
      row({
        calcMode: "flip",
        calcSnapshot: JSON.stringify({
          mode: "flip",
          netProfit: 850_000,
          sourcingFee: 100_000,
          totalCost: 6_000_000,
          cooperation: {
            availability: "both",
            netProfitTotal: 950_000,
            investorProfitFiftyFifty: 475_000,
            investorProfitSourcing: 850_000,
            sourcingFee: 100_000,
          },
        }),
      }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.cooperation?.availableStrategies).toEqual(["fifty-fifty", "sourcing-fee"]);
    expect(view.cooperation?.netProfitTotal).toBe(950_000);
    expect(view.cooperation?.investorProfitFiftyFifty).toBe(475_000);
    expect(view.cooperation?.investorProfitSourcing).toBe(850_000);
    expect(view.cooperation?.sourcingFee).toBe(100_000);
    expect(view.cooperation?.fundingFiftyFifty).toBe(5_900_000);
    expect(view.cooperation?.fundingSourcing).toBe(6_000_000);
    expect(view.cooperation?.investorRoiFiftyFifty).toBe(8.1);
    expect(view.cooperation?.investorRoiSourcing).toBe(14.2);
  });

  it("cooperation respects strategy locked to a single mode", () => {
    const view = toPortalView(
      row({
        calcMode: "flip",
        calcSnapshot: JSON.stringify({
          mode: "flip",
          netProfit: 900_000,
          cooperation: {
            availability: "sourcing-fee",
            netProfitTotal: 900_000,
            investorProfitFiftyFifty: 450_000,
            investorProfitSourcing: 800_000,
            sourcingFee: 100_000,
          },
        }),
      }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.cooperation?.availableStrategies).toEqual(["sourcing-fee"]);
  });

  it("legacy snapshot without cooperation block derives both variants", () => {
    const coop = flipCooperationFromSnapshot({
      mode: "flip",
      netProfit: 800_000,
      sourcingFee: 100_000,
      totalCost: 6_000_000,
    } as CalcSnapshotFlip);
    expect(coop?.availableStrategies).toEqual(["fifty-fifty", "sourcing-fee"]);
    expect(coop?.netProfitTotal).toBe(900_000);
    expect(coop?.investorProfitFiftyFifty).toBe(450_000);
    expect(coop?.investorProfitSourcing).toBe(800_000);
    expect(coop?.fundingFiftyFifty).toBe(5_900_000);
    expect(coop?.fundingSourcing).toBe(6_000_000);
    expect(coop?.investorRoiFiftyFifty).toBe(7.6);
    expect(coop?.investorRoiSourcing).toBe(13.3);
  });

  it("legacy snapshot without fee derives gross profit and no fee", () => {
    const coop = flipCooperationFromSnapshot({
      mode: "flip",
      netProfit: 500_000,
    } as CalcSnapshotFlip);
    expect(coop?.netProfitTotal).toBe(500_000);
    expect(coop?.investorProfitFiftyFifty).toBe(250_000);
    expect(coop?.investorProfitSourcing).toBe(500_000);
    expect(coop?.sourcingFee).toBeNull();
    expect(coop?.fundingFiftyFifty).toBeNull();
    expect(coop?.fundingSourcing).toBeNull();
    expect(coop?.investorRoiFiftyFifty).toBeNull();
    expect(coop?.investorRoiSourcing).toBeNull();
  });

  it("recomputes deal and cooperation exactly from itemized snapshot at negotiated price", () => {
    const view = toPortalView(
      row({
        stageData: JSON.stringify({ negotiation: { currentAmount: 2_500_000 } }),
        calcSnapshot: JSON.stringify({
          mode: "flip",
          purchasePriceUsed: 2_596_400,
          arv: 4_562_177,
          renovationCost: 770_000,
          legalFees: 25_000,
          appraisalFee: 0,
          contingency: 77_000,
          holdingCosts: 32_400,
          holdingMonths: 6,
          sellingCommission: 0,
          marketingPhoto: 20_000,
          mortgageCost: 0,
          sourcingFee: 0,
          incomeTax: 218_689,
          totalCost: 3_739_489,
          netProfit: 822_688,
          roi: 22.0,
          annualizedRoi: 44.0,
          cashOnCash: 31.7,
        }),
      }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.offerPrice).toBe(2_500_000);
    expect(view.deal.type === "flip" && view.deal.netProfit).toBe(898_844);
    expect(view.deal.type === "flip" && view.deal.roi).toBe(24.5);
    expect(view.cooperation?.fundingSourcing).toBe(3_663_333);
  });

  it("computes cooperation and deal profit from the negotiated pipeline price", () => {
    const view = toPortalView(
      row({
        stageData: JSON.stringify({ negotiation: { currentAmount: 5_600_000 } }),
        calcSnapshot: JSON.stringify({
          mode: "flip",
          purchasePriceUsed: 5_655_000,
          totalCost: 6_000_000,
          netProfit: 800_000,
          roi: 13.3,
          annualizedRoi: 21.6,
          arv: 13_700_000,
          cashOnCash: 13.3,
          sourcingFee: 100_000,
          cooperation: {
            availability: "both",
            netProfitTotal: 900_000,
            investorProfitFiftyFifty: 450_000,
            investorProfitSourcing: 800_000,
            sourcingFee: 100_000,
          },
        }),
      }),
      "inv",
      { budget: null, unlimited: true }
    );
    expect(view.offerPrice).toBe(5_600_000);
    expect(view.cooperation?.netProfitTotal).toBe(955_000);
    expect(view.cooperation?.investorProfitFiftyFifty).toBe(477_500);
    expect(view.cooperation?.investorProfitSourcing).toBe(855_000);
    expect(view.cooperation?.fundingFiftyFifty).toBe(5_845_000);
    expect(view.cooperation?.fundingSourcing).toBe(5_945_000);
    expect(view.cooperation?.investorRoiFiftyFifty).toBe(8.2);
    expect(view.cooperation?.investorRoiSourcing).toBe(14.4);
    expect(view.deal.type === "flip" && view.deal.netProfit).toBe(855_000);
    expect(view.deal.type === "flip" && view.deal.roi).toBe(14.4);
  });
});

describe("rentalTotalAcquisitionCost / rentalLoanCapped", () => {
  const snap = (over: Partial<CalcSnapshotRental> = {}): CalcSnapshotRental =>
    ({
      mode: "rental",
      purchasePriceUsed: null,
      monthlyRent: null,
      netYield: null,
      grossYield: null,
      netYieldAfterTax: null,
      capRate: null,
      cashFlowMonthly: null,
      totalInvested: null,
      noiAnnual: null,
      cashOnCash: null,
      targetPurchasePrice: 1_989_440,
      legalFee: 25_000,
      appraisalFee: null,
      sourcingFee: null,
      renovationCost: 937_500,
      ...over,
    });

  it("sums purchase price + optional costs (Celková investice)", () => {
    expect(rentalTotalAcquisitionCost(snap())).toBe(2_951_940);
  });

  it("ignores missing parts and returns null without target price", () => {
    expect(rentalTotalAcquisitionCost(snap({ legalFee: null, renovationCost: null }))).toBe(1_989_440);
    expect(rentalTotalAcquisitionCost(null)).toBeNull();
    expect(rentalTotalAcquisitionCost(snap({ targetPurchasePrice: null }))).toBeNull();
  });

  it("caps loan at target purchase price", () => {
    expect(rentalLoanCapped(snap({ hasMortgage: true, mortgageAmount: 3_400_000 }))).toBe(1_989_440);
    expect(rentalLoanCapped(snap({ hasMortgage: true, mortgageAmount: 800_000 }))).toBe(800_000);
    expect(rentalLoanCapped(snap())).toBe(0);
    expect(rentalLoanCapped(snap({ hasMortgage: false, mortgageAmount: 3_400_000 }))).toBe(0);
  });

  it("carries LTV through snapshot (optional, legacy safe)", () => {
    const withLtv = snap({ hasMortgage: true, mortgageAmount: 1_400_000, ltv: 70 });
    expect(withLtv.ltv).toBe(70);
    const legacy = snap();
    expect(legacy.ltv).toBeUndefined();
    const parsed = parseCalcSnapshot(JSON.stringify(withLtv)) as CalcSnapshotRental;
    expect(parsed.ltv).toBe(70);
  });

  it("carries fond oprav (SVJ) through snapshot (optional, legacy safe)", () => {
    const withSvj = snap({ svjFeeMonthly: 2_800, svjIsEstimate: true });
    expect(withSvj.svjFeeMonthly).toBe(2_800);
    expect(withSvj.svjIsEstimate).toBe(true);
    const legacy = snap();
    expect(legacy.svjFeeMonthly).toBeUndefined();
    expect(legacy.svjIsEstimate).toBeUndefined();
    const parsed = parseCalcSnapshot(JSON.stringify(withSvj)) as CalcSnapshotRental;
    expect(parsed.svjFeeMonthly).toBe(2_800);
    expect(parsed.svjIsEstimate).toBe(true);
  });
});