import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/properties/[id]/calc-preset/route";

// Mock auth a db, ať otestujeme reálnou route end-to-end.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

// In-memory simulace DB: jedna "tabulka" (Map id -> row) na drizzle table objekt.
// limit() vrací POLE řádků — route na výsledku volá .then(r => r[0]).
const dbMock = vi.hoisted(() => {
  const tables = new Map<any, Map<string, any>>();
  const storeFor = (t: any) => {
    if (!tables.has(t)) tables.set(t, new Map());
    return tables.get(t)!;
  };
  const thenable = (run: any) => ({ then: (resolve: any) => resolve(run()) });

  return {
    db: {
      select: () => ({
        from: (t: any) => ({
          where: () => ({
            limit: () => thenable(() => [...storeFor(t).values()]),
          }),
        }),
      }),
      insert: (t: any) => ({
        values: (v: any) => {
          storeFor(t).set(v.id, { ...v });
          return {};
        },
      }),
      update: (t: any) => ({
        set: (v: any) => ({
          where: () => {
            for (const row of storeFor(t).values()) Object.assign(row, v);
            return thenable(() => undefined);
          },
        }),
      }),
      delete: (t: any) => ({
        where: () => {
          storeFor(t).clear();
          return thenable(() => undefined);
        },
      }),
    },
    reset: () => tables.clear(),
  };
});

vi.mock("@/db", () => ({ db: dbMock.db }));

describe("calc-preset round-trip manualFlipPrice", () => {
  beforeEach(() => {
    dbMock.reset();
    vi.clearAllMocks();
  });

  const presetBody = {
    arv: 4_562_177,
    renovationCost: 770_000,
    targetRoi: 22,
    costConfig: { sourcingEnabled: true, sourcingFee: 100000 },
    flipStrategy: "both",
    mode: "flip",
    manualFlipPrice: 2_500_000,
    purchasePriceUsed: 2_500_000,
  };

  it("POST uloží manualFlipPrice a GET ho vrátí", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/properties/prop-1/calc-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(presetBody),
      }),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(postRes.status).toBe(200);

    const getRes = await GET(
      new Request("http://localhost/api/properties/prop-1/calc-preset"),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(getRes.status).toBe(200);
    const json = await getRes.json();
    expect(json.preset.config.manualFlipPrice).toBe(2_500_000);
  });

  it("GET vrátí preset: null, když ještě není uložený", async () => {
    const getRes = await GET(
      new Request("http://localhost/api/properties/prop-1/calc-preset"),
      { params: Promise.resolve({ id: "prop-1" }) }
    );
    expect(getRes.status).toBe(200);
    const json = await getRes.json();
    expect(json.preset).toBeNull();
  });
});
