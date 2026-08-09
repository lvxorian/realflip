import { describe, it, expect } from "vitest";
import {
  LEAD_STAGES,
  LEAD_STAGE_KEYS,
  isValidLeadStage,
  stageProbability,
  leadDealValue,
  leadExpectedValue,
  leadExpectedProfit,
  timeInStageDays,
  agingLevel,
  resolveDropTarget,
  TIME_IN_STAGE_WARN_DAYS,
} from "../leads";

describe("lead stages", () => {
  it("obsahuje všech 7 fází pipeline", () => {
    expect(LEAD_STAGES.map((s) => s.key)).toEqual([
      "new",
      "contacted",
      "meeting",
      "offer",
      "negotiation",
      "closed",
      "lost",
    ]);
  });

  it("isValidLeadStage schválí platné fáze", () => {
    for (const stage of LEAD_STAGE_KEYS) {
      expect(isValidLeadStage(stage)).toBe(true);
    }
  });

  it("isValidLeadStage zamítne neplatné fáze", () => {
    expect(isValidLeadStage("archived")).toBe(false);
    expect(isValidLeadStage("")).toBe(false);
    expect(isValidLeadStage("CLOSED")).toBe(false);
  });
});

describe("stage probability (weighted forecast)", () => {
  it("pravděpodobnosti rostou s postupem pipeline", () => {
    const probs = LEAD_STAGES.map((s) => s.probability);
    expect(probs[0]).toBe(0.1);
    expect(probs[6]).toBe(0);
    expect(probs[5]).toBe(1);
    for (let i = 1; i < probs.length - 1; i++) {
      expect(probs[i]).toBeGreaterThan(probs[i - 1]);
    }
  });

  it("stageProbability vrací 0 pro neznámou fázi", () => {
    expect(stageProbability("nonsense")).toBe(0);
    expect(stageProbability("new")).toBe(0.1);
    expect(stageProbability("closed")).toBe(1);
  });
});

describe("leadDealValue / leadExpectedValue", () => {
  const lead = {
    stage: "offer",
    stageData: { offer: { amount: 2_500_000 } },
    analysisTargetPurchasePrice: 2_400_000,
    propertyPrice: 2_800_000,
  };

  it("deal value má prioritu nabídka > cílová cena > cenovka", () => {
    expect(leadDealValue(lead)).toBe(2_500_000);
    expect(
      leadDealValue({ ...lead, stageData: {} })
    ).toBe(2_400_000);
    expect(
      leadDealValue({ ...lead, stageData: {}, analysisTargetPurchasePrice: null })
    ).toBe(2_800_000);
    expect(leadDealValue({ ...lead, stageData: {}, analysisTargetPurchasePrice: null, propertyPrice: null })).toBe(0);
  });

  it("očekávaná hodnota = deal value × pravděpodobnost fáze", () => {
    expect(leadExpectedValue(lead)).toBe(2_500_000 * 0.55);
    expect(leadExpectedValue({ ...lead, stage: "closed" })).toBe(2_500_000);
    expect(leadExpectedValue({ ...lead, stage: "lost" })).toBe(0);
  });

  it("očekávaný zisk = p × (ARV − cílová nákupní cena); 0 bez ARV/TPP", () => {
    expect(leadExpectedProfit({ stage: "offer", analysisArv: 3_000_000, analysisTargetPurchasePrice: 2_400_000 })).toBe(
      600_000 * 0.55
    );
    expect(leadExpectedProfit({ stage: "offer", analysisArv: null, analysisTargetPurchasePrice: 2_400_000 })).toBe(0);
    expect(leadExpectedProfit({ stage: "lost", analysisArv: 3_000_000, analysisTargetPurchasePrice: 2_400_000 })).toBe(0);
  });
});

describe("aging (time in stage)", () => {
  const now = 1_000_000_000_000;

  it("timeInStageDays počítá celé dny; null/0 → 0", () => {
    expect(timeInStageDays(null, now)).toBe(0);
    expect(timeInStageDays(0, now)).toBe(0);
    expect(timeInStageDays(now - 2 * 86_400_000, now)).toBe(2);
    expect(timeInStageDays(now - 3.5 * 86_400_000, now)).toBe(3);
    expect(timeInStageDays(now + 5 * 86_400_000, now)).toBe(0);
  });

  it("agingLevel: 0 klid, warn od 3, danger od 7 dní", () => {
    expect(agingLevel(0)).toBe(0);
    expect(agingLevel(TIME_IN_STAGE_WARN_DAYS - 1)).toBe(0);
    expect(agingLevel(TIME_IN_STAGE_WARN_DAYS)).toBe(1);
    expect(agingLevel(6)).toBe(1);
    expect(agingLevel(7)).toBe(2);
    expect(agingLevel(30)).toBe(2);
  });
});

describe("resolveDropTarget", () => {
  const leads = [
    { id: "l1", stage: "new" },
    { id: "l2", stage: "closed" },
  ];

  it("cíl z nadhozené karty = její fáze", () => {
    expect(resolveDropTarget("l2", null, leads)).toBe("closed");
  });

  it("cíl z dat sloupce = jeho fáze", () => {
    expect(resolveDropTarget("closed", { stage: "closed" }, leads)).toBe("closed");
  });

  it("cíl z id sloupce (bez dat) = fáze", () => {
    expect(resolveDropTarget("meeting", undefined, leads)).toBe("meeting");
  });

  it("neznámý cíl → null", () => {
    expect(resolveDropTarget("garbage", null, leads)).toBe(null);
    expect(resolveDropTarget(42, null, leads)).toBe(null);
    expect(resolveDropTarget("", undefined, leads)).toBe(null);
  });
});
