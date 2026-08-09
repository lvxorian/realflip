import { describe, it, expect } from "vitest";
import { moveLeadToStage, reorderLeadInStage, type BoardLead } from "../pipeline-board";

const DAY = 86_400_000;
const now = Date.now();

function lead(id: string, stage: string, position: number | null = null): BoardLead {
  return { id, stage, position, stageEnteredAt: now, updatedAt: now };
}

const board: BoardLead[] = [
  lead("a", "new", 0),
  lead("b", "new", 1),
  lead("c", "offer", 0),
  lead("d", "closed", 0),
];

describe("moveLeadToStage", () => {
  it("přesune do prázdné fáze na konec", () => {
    const res = moveLeadToStage(board, "a", "lost", null);
    expect(res).not.toBeNull();
    expect(res!.newPos).toBe(0);
    const target = res!.leads.find((l) => l.id === "a");
    expect(target?.stage).toBe("lost");
    expect(target?.position).toBe(0);
    expect(res!.leads.filter((l) => l.id !== "a" && l.stage !== "new" && l.stage !== "lost").length).toBe(2);
  });

  it("přesune mezi karty v cílové fázi (před overId)", () => {
    const res = moveLeadToStage(board, "a", "offer", "c");
    expect(res!.newPos).toBe(0);
    const offerIds = res!.leads.filter((l) => l.stage === "offer").map((l) => l.id);
    expect(offerIds).toEqual(["a", "c"]);
  });

  it("přesun na konec cílové fáze bez overId", () => {
    const res = moveLeadToStage(board, "a", "offer", null);
    expect(res!.newPos).toBe(1);
    const offerIds = res!.leads.filter((l) => l.stage === "offer").map((l) => l.id);
    expect(offerIds).toEqual(["c", "a"]);
  });

  it("positionOverride umístí na konkrétní index (undo)", () => {
    const b = moveLeadToStage(board, "b", "closed", null);
    const back = moveLeadToStage(b!.leads, "b", "new", null, 1);
    expect(back!.newPos).toBe(1);
    const newIds = back!.leads.filter((l) => l.stage === "new").map((l) => l.id);
    expect(newIds).toEqual(["a", "b"]);
  });

  it("positionOverride nad délku → konec (clamp)", () => {
    const res = moveLeadToStage(board, "a", "closed", null, 99);
    expect(res!.newPos).toBe(1);
  });

  it("neexistující lead → null", () => {
    expect(moveLeadToStage(board, "zzz", "lost", null)).toBeNull();
  });

  it("změna fáze nastaví stageEnteredAt na teď; stejná fáze ho nechává", () => {
    const moved = moveLeadToStage(board, "a", "offer", null);
    expect(moved!.leads.find((l) => l.id === "a")!.stageEnteredAt).toBeGreaterThanOrEqual(now);
    const same = moveLeadToStage(board, "a", "new", null, 2);
    const original = board.find((l) => l.id === "a")!;
    expect(same!.leads.find((l) => l.id === "a")!.stageEnteredAt).toBe(original.stageEnteredAt);
  });
});

describe("reorderLeadInStage", () => {
  it("přerovná karty uvnitř fáze a přepíše pozice", () => {
    const res = reorderLeadInStage([...board, lead("e", "new", 2)], "a", "b");
    expect(res!.newPos).toBe(1);
    const newIds = res!.leads.filter((l) => l.stage === "new").sort((x, y) => (x.position ?? 0) - (y.position ?? 0)).map((l) => l.id);
    expect(newIds).toEqual(["b", "a", "e"]);
    expect(res!.leads.filter((l) => l.stage === "new").every((l) => l.position != null)).toBe(true);
  });

  it("reorder z konce dopředu", () => {
    const res = reorderLeadInStage([...board, lead("e", "new", 2)], "e", "a");
    expect(res!.newPos).toBe(0);
  });

  it("karty z jiných fází zůstávají nedotčené", () => {
    const res = reorderLeadInStage(board, "a", "b");
    expect(res!.leads.filter((l) => l.id === "c" || l.id === "d").length).toBe(2);
    expect(res!.leads.find((l) => l.id === "c")!.stage).toBe("offer");
    expect(res!.leads.find((l) => l.id === "d")!.stage).toBe("closed");
  });

  it("křížení fází nebo stejná pozice → null", () => {
    expect(reorderLeadInStage(board, "a", "c")).toBeNull();
    expect(reorderLeadInStage(board, "a", "a")).toBeNull();
    expect(reorderLeadInStage(board, "zzz", "b")).toBeNull();
  });
});