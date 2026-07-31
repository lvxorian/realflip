import { describe, it, expect } from "vitest";
import { LEAD_STAGES, LEAD_STAGE_KEYS, isValidLeadStage } from "../leads";

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
