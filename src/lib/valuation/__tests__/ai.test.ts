import { describe, expect, it } from "vitest";
import { sanitizeAiCorrection, MAX_AI_ADJUSTMENT_PCT } from "../ai";

const BASE_PER_SQM = 100_000;
const BASE_ESTIMATE = 5_000_000;

describe("sanitizeAiCorrection", () => {
  it("spočítá korekci dolů (záporná úprava)", () => {
    const out = sanitizeAiCorrection(
      {
        adjustmentPct: -6.5,
        confidence: "Střední",
        reasoning: "K Lučinám je levnější kapsa Žižkova, kompy 1 km se prodávají níž.",
        factors: ["levnější kapsa lokality", "průjezdná silnice v okolí"],
      },
      BASE_PER_SQM,
      BASE_ESTIMATE
    );
    expect(out).not.toBeNull();
    expect(out!.adjustmentPct).toBe(-6.5);
    expect(out!.direction).toBe("down");
    expect(out!.adjustedPricePerSqm).toBe(Math.round(100_000 * 0.935));
    expect(out!.adjustedEstimate).toBe(Math.round(5_000_000 * 0.935));
    expect(out!.factors).toHaveLength(2);
  });

  it("spočítá korekci nahoru (kladná úprava)", () => {
    const out = sanitizeAiCorrection(
      { adjustmentPct: 4, confidence: "Vysoká", reasoning: "Byt 2 min od metra, klidná ulice." },
      BASE_PER_SQM,
      BASE_ESTIMATE
    );
    expect(out!.adjustmentPct).toBe(4);
    expect(out!.direction).toBe("up");
    expect(out!.adjustedPricePerSqm).toBe(104_000);
  });

  it("neutrální u nuly", () => {
    const out = sanitizeAiCorrection(
      { adjustmentPct: 0, confidence: "Nízká", reasoning: "Bez jednoznačných signálů mikro-polohy." },
      BASE_PER_SQM,
      BASE_ESTIMATE
    );
    expect(out!.direction).toBe("neutral");
    expect(out!.adjustedEstimate).toBe(BASE_ESTIMATE);
  });

  it("clampne úpravu na ±15 % i při extrémní odpovědi modelu", () => {
    const out = sanitizeAiCorrection(
      { adjustmentPct: 40, confidence: "Střední", reasoning: "Extrémní tvrzení modelu." },
      BASE_PER_SQM,
      BASE_ESTIMATE
    );
    expect(out!.adjustmentPct).toBe(MAX_AI_ADJUSTMENT_PCT);
    expect(out!.adjustedPricePerSqm).toBe(115_000);

    const down = sanitizeAiCorrection(
      { adjustmentPct: -99, confidence: "Střední", reasoning: "Extrémní tvrzení modelu." },
      BASE_PER_SQM,
      BASE_ESTIMATE
    );
    expect(down!.adjustmentPct).toBe(-MAX_AI_ADJUSTMENT_PCT);
  });

  it("vrátí null pro nevalidní odpověď (chybí číslo nebo reasoning)", () => {
    expect(sanitizeAiCorrection({ confidence: "Vysoká", reasoning: "bez čísla" }, BASE_PER_SQM, BASE_ESTIMATE)).toBeNull();
    expect(sanitizeAiCorrection({ adjustmentPct: "abc", reasoning: "text" }, BASE_PER_SQM, BASE_ESTIMATE)).toBeNull();
    expect(sanitizeAiCorrection({ adjustmentPct: 5, reasoning: "   " }, BASE_PER_SQM, BASE_ESTIMATE)).toBeNull();
    expect(sanitizeAiCorrection(null, BASE_PER_SQM, BASE_ESTIMATE)).toBeNull();
  });

  it("zachová jen čisté faktory a omezí jich počet na 4", () => {
    const out = sanitizeAiCorrection(
      {
        adjustmentPct: -2,
        confidence: "Střední",
        reasoning: "Odůvodnění.",
        factors: ["a", "", "  ", "b", "c", "d", "e"],
      },
      BASE_PER_SQM,
      BASE_ESTIMATE
    );
    expect(out!.factors).toEqual(["a", "b", "c", "d"]);
  });

  it("zaokrouhlí úpravu na 1 desetinné místo", () => {
    const out = sanitizeAiCorrection(
      { adjustmentPct: 3.333333, confidence: "Střední", reasoning: "Zaokrouhlení." },
      BASE_PER_SQM,
      BASE_ESTIMATE
    );
    expect(out!.adjustmentPct).toBe(3.3);
  });
});
