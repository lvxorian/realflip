import { describe, it, expect } from "vitest";
import {
  scoreUnemployment,
  scoreMigration,
  scoreAgeStructure,
  scoreCrime,
  scoreWalkability,
  computeLocalityFactors,
  localityScoreAdjustment,
} from "../locality/score";

describe("locality scoring", () => {
  it("scoreUnemployment: nižší nezaměstnanost = vyšší skóre", () => {
    expect(scoreUnemployment(3)).toBe(75);
    expect(scoreUnemployment(10)).toBe(17);
    expect(scoreUnemployment(0)).toBe(100);
    expect(scoreUnemployment(15)).toBe(0);
    expect(scoreUnemployment(null)).toBe(0);
  });

  it("scoreMigration: kladné saldo = lepší", () => {
    expect(scoreMigration(0)).toBe(50);
    expect(scoreMigration(10)).toBe(100);
    expect(scoreMigration(-10)).toBe(0);
    expect(scoreMigration(null)).toBe(0);
  });

  it("scoreAgeStructure: mladší populace = lepší", () => {
    expect(scoreAgeStructure(15)).toBe(90);
    expect(scoreAgeStructure(20)).toBe(67);
    expect(scoreAgeStructure(30)).toBe(21);
    expect(scoreAgeStructure(null)).toBe(0);
  });

  it("scoreCrime: nižší index = lepší", () => {
    expect(scoreCrime(200)).toBe(74);
    expect(scoreCrime(600)).toBe(2);
    expect(scoreCrime(null)).toBe(0);
  });

  it("scoreWalkability: více POI = vyšší skóre", () => {
    expect(scoreWalkability({ mhd: 5, vlak: 1, skoly: 2, obchody: 3 })).toBeGreaterThan(0);
    expect(scoreWalkability({})).toBe(0);
    expect(scoreWalkability(null)).toBe(0);
  });

  it("computeLocalityFactors váží jen dostupné dimenze", () => {
    const full = computeLocalityFactors({
      unemployment: 3,
      migrationPer1000: 5,
      share65plus: 18,
      firms: 2000,
      population: 100000,
      crimeIndex: 250,
      walkability: 70,
    });
    expect(full.total).toBeGreaterThan(40);
    expect(full.missing).toEqual([]);

    // Chybějící dimenze nepoškodí skóre (přepočet vah)
    const partial = computeLocalityFactors({ walkability: 100 });
    expect(partial.missing.length).toBeGreaterThan(0);
    expect(partial.total).toBe(100);
  });

  it("localityScoreAdjustment upravuje o max ±8", () => {
    expect(localityScoreAdjustment(50)).toBe(0);
    expect(localityScoreAdjustment(100)).toBe(8);
    expect(localityScoreAdjustment(0)).toBe(-8);
    expect(localityScoreAdjustment(null)).toBe(0);
  });
});
