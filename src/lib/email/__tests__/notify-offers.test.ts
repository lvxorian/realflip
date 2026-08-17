import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { leads, investors, investorOfferEmails } from "@/db/schema";
import { sendEmail } from "@/lib/email/send-email";
import { buildOfferEmailHtml } from "@/lib/email/offer-template";
import { toPortalView } from "@/lib/investor-portal-view";
import { notifyInvestorsOfOffer } from "../notify-offers";

vi.mock("@/lib/email/send-email", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/email/offer-template", () => ({
  buildOfferEmailHtml: vi.fn(() => "<html>nabídka</html>"),
}));
vi.mock("@/lib/investor-portal-view", () => ({
  toPortalView: vi.fn(() => ({ city: "Praha", district: "Vinohrady" })),
}));

interface OfferDbState {
  leadRow: Record<string, unknown> | null;
  candidates: Record<string, unknown>[];
  sent: Record<string, unknown>[];
  inserted: Record<string, unknown>[];
}

// Konfigurovatelný mock db — stav sdílí s testy přes __state.
vi.mock("@/db", () => {
  const __state: OfferDbState = {
    leadRow: null,
    candidates: [],
    sent: [],
    inserted: [],
  };
  return {
    __state,
    db: {
      select: () => ({
        from: (table: unknown) => {
          if (table === leads) {
            return {
              innerJoin: () => ({
                leftJoin: () => ({
                  leftJoin: () => ({
                    where: () => ({
                      limit: async () => (__state.leadRow ? [__state.leadRow] : []),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === investors) {
            return { where: async () => __state.candidates };
          }
          if (table === investorOfferEmails) {
            return { where: async () => __state.sent };
          }
          throw new Error("Neočekávaná tabulka v select().from()");
        },
      }),
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          __state.inserted.push(values);
        },
      }),
    },
  };
});

// Hoisted import — vrátí __state z factory (vi.mock je hoistované nad importy).
const { __state } = (await import("@/db")) as unknown as { __state: OfferDbState };

const sendEmailMock = vi.mocked(sendEmail);

const leadRow = (over: Record<string, unknown> = {}) => ({
  leadId: "lead-1",
  stage: "negotiation",
  portalVisible: 1,
  portalStatus: "available",
  reservedById: null,
  reservedByName: null,
  isActive: 1,
  district: "Vinohrady",
  city: "Praha",
  condition: "velmi dobrý",
  buildingType: "cihla",
  area: 62,
  rooms: "2+kk",
  floor: 3,
  originalPrice: 2900000,
  imageUrls: "[]",
  stageData: "{}",
  locationCategory: null,
  arv: 3900000,
  renovationCost: 350000,
  monthlyRent: null,
  calcMode: "flip",
  netProfit: 550000,
  roi: 0.22,
  annualizedRoi: 0.11,
  cashOnCash: null,
  rentalYield: null,
  cashFlowMonthly: null,
  calcSnapshot: null,
  ...over,
});

const investorRow = (id: string, email: string) => ({ id, email, portalEnabled: 1 });

describe("notifyInvestorsOfOffer", () => {
  beforeEach(() => {
    vi.stubEnv("OFFER_EMAIL_RETRY_DELAY_MS", "0");
    __state.leadRow = leadRow();
    __state.candidates = [investorRow("inv-a", "a@example.cz"), investorRow("inv-b", "b@example.cz")];
    __state.sent = [];
    __state.inserted = [];
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ sent: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("odesle vsem recipientum a zapise dedup zaznamy", async () => {
    const sent = await notifyInvestorsOfOffer("lead-1");

    expect(sent).toBe(2);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(__state.inserted).toHaveLength(2);
    expect(__state.inserted.map((r) => r.investorId)).toEqual(["inv-a", "inv-b"]);
  });

  it("prechodne selhani odeslani zkusí znovu a zapise dedup", async () => {
    sendEmailMock
      .mockResolvedValueOnce({ sent: false, reason: "network_error" })
      .mockResolvedValue({ sent: true });

    const sent = await notifyInvestorsOfOffer("lead-1");

    expect(sent).toBe(2);
    // 1. investor: pokus + retry, 2. investor: jeden pokus
    expect(sendEmailMock).toHaveBeenCalledTimes(3);
    expect(__state.inserted).toHaveLength(2);
  });

  it("trvale selhani nezapise dedup a pokracuje k dalsimu", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, reason: "resend_error_400" });

    const sent = await notifyInvestorsOfOffer("lead-1");

    expect(sent).toBe(0);
    // 2 investoři × (pokus + retry)
    expect(sendEmailMock).toHaveBeenCalledTimes(4);
    expect(__state.inserted).toHaveLength(0);
  });

  it("preskoci lead mimo faze negotiation / neaktivni — bez odeslani", async () => {
    __state.leadRow = leadRow({ stage: "new" });

    const sent = await notifyInvestorsOfOffer("lead-1");

    expect(sent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(__state.inserted).toHaveLength(0);
  });

  it("preskoci jiz notifikovane investory (dedup pres investor_offer_emails)", async () => {
    __state.sent = [{ investorId: "inv-a" }];

    const sent = await notifyInvestorsOfOffer("lead-1");

    expect(sent).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(__state.inserted.map((r) => r.investorId)).toEqual(["inv-b"]);
  });
});
