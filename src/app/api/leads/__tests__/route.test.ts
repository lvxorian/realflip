import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "../[id]/route";

// In-memory "DB" records
let existingLead: Record<string, unknown> | null = null;
const updated = vi.fn();
const setMock = vi.fn((_update: Record<string, unknown>) => ({
  where: vi.fn(() => ({
    then: vi.fn(async (cb: (r: unknown) => unknown) => cb(undefined)),
  })),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            then: async (cb: (r: Record<string, unknown>[]) => unknown) => cb(existingLead ? [existingLead] : []),
          }),
        }),
      }),
    }),
    update: () => ({ set: setMock }),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/lead-events", () => ({
  logLeadEvent: async () => {},
  normalizeLeadEventPayload: (raw: unknown) => {
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw ?? {};
  },
}));

vi.mock("@/lib/email/notify-offers", () => ({
  notifyInvestorsOfOffer: async () => {},
}));

function jsonReq(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/leads/lead-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/leads/[id] — potvrzení vyjednané ceny", () => {
  beforeEach(() => {
    existingLead = {
      id: "lead-1",
      userId: "user-1",
      propertyId: "prop-1",
      stage: "new",
      stageData: "{}",
      position: 0,
    };
    updated.mockClear();
    setMock.mockClear();
  });

  it("přijme stage negotiation s vyjednanou cenou ve stageData", async () => {
    const res = await PATCH(
      jsonReq({
        stage: "negotiation",
        position: 0,
        stageData: {
          negotiation: {
            currentAmount: 1950000,
            history: [{ price: 1950000, date: new Date().toISOString(), by: "them" }],
          },
        },
      }),
      { params: Promise.resolve({ id: "lead-1" }) }
    );

    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalled();
    const updateArg = setMock.mock.calls[0]?.[0] as unknown as Record<string, unknown> | undefined;
    expect(updateArg?.stage).toBe("negotiation");
    expect(updateArg?.stageEnteredAt).toBeTypeOf("number");
  });

  it("odmítne stage negotiation bez vyjednané ceny", async () => {
    const res = await PATCH(
      jsonReq({
        stage: "negotiation",
        position: 0,
        stageData: { negotiation: { currentAmount: null, history: [] } },
      }),
      { params: Promise.resolve({ id: "lead-1" }) }
    );

    expect(res.status).toBe(400);
  });
});
