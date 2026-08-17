import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "../[id]/route";

// In-memory "DB" records
let existingLead: Record<string, unknown> | null = null;
const updated = vi.fn();
const setMock = vi.fn((_update: Record<string, unknown>) => ({
  where: vi.fn(() => ({
    then: vi.fn(async (cb: (r: unknown) => unknown) => cb(undefined)),
  })),
}));
const deleteMock = vi.fn(() => ({
  where: vi.fn(() => Promise.resolve()),
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
    delete: () => deleteMock(),
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

function deleteReq(): Request {
  return new Request("http://localhost/api/leads/lead-1", { method: "DELETE" });
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

describe("DELETE /api/leads/[id] — trvalé odstranění leadu z pipeline", () => {
  beforeEach(() => {
    existingLead = {
      id: "lead-1",
      userId: "user-1",
      propertyId: "prop-1",
      stage: "new",
      stageData: "{}",
      position: 0,
    };
    deleteMock.mockClear();
  });

  it("smaže lead patřící uživateli", async () => {
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: "lead-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it("vrátí 404, když lead neexistuje nebo nepatří uživateli — nic se nesmaže", async () => {
    existingLead = null;

    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: "lead-1" }) });

    expect(res.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
