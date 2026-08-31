import { describe, it, expect } from "vitest";
import { scoreAresCompany, } from "../scorer";
import { extractLiquidationDate } from "../ares-client";
import { hasApartment } from "../catastr-client";
import type { VrCompanyDetail, CatastrOwnership } from "../types";

const NOW = Date.parse("2026-08-30T00:00:00Z");

function makeDetail(overrides: Partial<VrCompanyDetail> = {}): VrCompanyDetail {
  return {
    ico: "01292790",
    name: "Testovací s.r.o.",
    legalForm: "112",
    sidlo: "Praha 1, Václavské nám. 1",
    court: "MSPH",
    spisovaZnacka: "MSPH C 1",
    status: "AKTIVNI",
    hasExecution: false,
    isLiquidating: true,
    liquidationReasoning: "Byla zrušena s likvidací a jmenován likvidátor.",
    liquidationDate: NOW - 30 * 24 * 60 * 60 * 1000,
    lastUpdatedAres: NOW,
    rawJson: {},
    ...overrides,
  };
}

describe("scoreAresCompany", () => {
  it("scores a liquidated s.r.o. with verified property higher than a spolek", () => {
    const verified: CatastrOwnership = {
      verified: true,
      reason: "Nalezeno 3 nemovitosti",
      totalLvs: 3,
      properties: [
        { katuzeKod: 1, lvId: 100, parcelniCislo: "123/1", typParcely: "STAVBA", vymera: 120, typBudovy: "byt.dům" },
      ],
    };
    const sro = scoreAresCompany(makeDetail(), verified, NOW);
    const spolek = scoreAresCompany(
      makeDetail({ legalForm: "706", name: "Spolek zahrádkářů", liquidationReasoning: "Spolek v likvidaci" }),
      verified,
      NOW
    );
    expect(sro.score).toBeGreaterThan(spolek.score);
  });

  it("downgrades a zaniklý subjekt", () => {
    const r = scoreAresCompany(makeDetail({ status: "ZANIKLY" }), null, NOW);
    const normal = scoreAresCompany(makeDetail(), null, NOW);
    expect(r.score).toBeLessThan(normal.score);
    expect(r.reasons.some((x) => x.includes("zanikl"))).toBe(true);
  });

  it("adds execution urgency", () => {
    const base = scoreAresCompany(makeDetail(), null, NOW).score;
    const withExe = scoreAresCompany(makeDetail({ hasExecution: true }), null, NOW).score;
    expect(withExe).toBeGreaterThan(base);
  });

  it("stays within 0-100", () => {
    const r = scoreAresCompany(makeDetail(), null, NOW);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("downgrades very old liquidation", () => {
    const old = makeDetail({ liquidationDate: NOW - 3 * 365 * 24 * 60 * 60 * 1000 });
    const fresh = makeDetail();
    expect(scoreAresCompany(old, null, NOW).score).toBeLessThan(
      scoreAresCompany(fresh, null, NOW).score
    );
  });
});

describe("extractLiquidationDate", () => {
  it("returns the latest liquidation record date", () => {
    const ostatni = [
      { datumZapisu: "2026-07-01", hodnota: "zrušena s likvidací" },
      { datumZapisu: "2026-08-27", hodnota: "Spolek v likvidaci oznamuje" },
      { datumZapisu: "2025-01-01", hodnota: "nezávislý záznam" },
    ];
    const d = extractLiquidationDate(ostatni);
    expect(d).toBe(Date.parse("2026-08-27"));
  });

  it("returns null when no liquidation record", () => {
    const ostatni = [
      { datumZapisu: "2026-07-01", hodnota: "Počet členů statutárního orgánu: 1" },
    ];
    expect(extractLiquidationDate(ostatni)).toBeNull();
  });
});

describe("hasApartment", () => {
  it("is true when a stavba is owned", () => {
    const o: CatastrOwnership = {
      verified: true,
      reason: "x",
      totalLvs: 1,
      properties: [{ katuzeKod: 1, lvId: 1, parcelniCislo: null, typParcely: "STAVBA", vymera: 100, typBudovy: null }],
    };
    expect(hasApartment(o)).toBe(true);
  });

  it("is false for parcela only", () => {
    const o: CatastrOwnership = {
      verified: true,
      reason: "x",
      totalLvs: 1,
      properties: [{ katuzeKod: 1, lvId: 1, parcelniCislo: "123/1", typParcely: "PARCELA", vymera: 500, typBudovy: null }],
    };
    expect(hasApartment(o)).toBe(false);
  });
});
