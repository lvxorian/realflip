import { describe, it, expect } from "vitest";
import { calculateReplacementCost } from "../analysis/replacement-cost";
import { scoreRentalYield, scoreTransport, scoreTransportDistance } from "../locality/score";

describe("replacement cost", () => {
  it("vypočítá reprodukční cenu z plochy a konstrukce", () => {
    const brick = calculateReplacementCost({ area: 80, buildingType: "brick", condition: "good" });
    expect(brick.costPerSqm).toBe(38000);
    expect(brick.total).toBe(3040000);
    expect(brick.conditionAdjusted).toBe(3040000);

    const panel = calculateReplacementCost({ area: 60, buildingType: "panel", condition: "original" });
    expect(panel.costPerSqm).toBe(30000);
    expect(panel.total).toBe(1800000);
    expect(panel.conditionAdjusted).toBe(1620000); // 0.9x
  });

  it("použije default stav a typ", () => {
    const r = calculateReplacementCost({ area: 70, buildingType: null, condition: null });
    expect(r.costPerSqm).toBe(35000);
    expect(r.total).toBe(2450000);
  });
});
