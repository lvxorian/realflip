import { describe, it, expect } from "vitest";
import { filterRecipients } from "../recipients";

const investor = (over: Partial<{ id: string; email: string | null; portalEnabled: number | null }> = {}) => ({
  id: "inv-1",
  email: "jan@example.cz",
  portalEnabled: 1,
  ...over,
});

describe("filterRecipients", () => {
  it("keeps enabled investors with email", () => {
    const result = filterRecipients([investor()], new Set());
    expect(result).toHaveLength(1);
  });

  it("skips investors without email or without portal access", () => {
    const result = filterRecipients(
      [investor({ id: "a", email: null }), investor({ id: "b", portalEnabled: 0 }), investor({ id: "c", email: "" })],
      new Set()
    );
    expect(result).toHaveLength(0);
  });

  it("skips already notified investors (dedup)", () => {
    const result = filterRecipients([investor({ id: "a" }), investor({ id: "b" })], new Set(["a"]));
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });
});
