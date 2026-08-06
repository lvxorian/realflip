import { describe, it, expect } from "vitest";
import { buildOfferEmailHtml, escapeHtml } from "../offer-template";
import type { InvestorPortalItem } from "@/lib/investor-portal-view";

const offer = (over: Partial<InvestorPortalItem> = {}): InvestorPortalItem => ({
  id: "lead-1",
  district: "Žižkov",
  city: "Praha 3",
  condition: "velmi dobrý",
  area: 89,
  rooms: "2+1",
  floor: 3,
  originalPrice: 13_690_000,
  offerPrice: 11_500_000,
  savingsPct: 16,
  netProfit: 1_250_000,
  roi: 10.8,
  status: "available",
  reservedByMe: false,
  reservedByName: null,
  overBudget: false,
  ...over,
});

describe("buildOfferEmailHtml", () => {
  it("renders all key offer fields", () => {
    const html = buildOfferEmailHtml(offer(), "https://realflip.app");
    expect(html).toContain("Praha 3 · Žižkov");
    expect(html).toContain("velmi dobrý · 2+1 · 89 m² · 3. podlaží");
    expect(html).toContain("11.5 mil. Kč");
    expect(html).toContain("−16.0 %");
    expect(html).toContain("https://realflip.app/investor");
    expect(html).toContain("Brickon · Nová nabídka");
    expect(html).toContain("#10b981");
    expect(html).not.toContain("#7c3aed");
    expect(html).toContain("fonts.googleapis.com/css2?family=Geist");
    expect(html).toContain("'Geist',Arial,Helvetica,sans-serif");
    expect(html).toContain("'Geist Mono',ui-monospace,monospace");
    expect(html).toContain("Tržní cena");
    expect(html).toContain("Kupní cena");
    expect(html).toContain("Sleva oproti trhu");
    expect(html).toContain("Odhadovaný zisk");
    expect(html).toContain("Vstoupit do portálu");
  });

  it("escapes HTML in location", () => {
    const html = buildOfferEmailHtml(offer({ city: "<b>Praha</b>" }), "https://realflip.app");
    expect(html).toContain("&lt;b&gt;Praha&lt;/b&gt;");
    expect(html).not.toContain("<b>Praha</b>");
  });

  it("handles missing values gracefully", () => {
    const html = buildOfferEmailHtml(
      offer({ originalPrice: null, offerPrice: null, savingsPct: null, netProfit: null, roi: null, area: null, floor: null, district: null, city: null }),
      "https://realflip.app"
    );
    expect(html).toContain("Neznámá lokalita");
    expect(html).toContain("—");
  });
});

describe("escapeHtml", () => {
  it("escapes special characters", () => {
    expect(escapeHtml(`a<b>&"c'`)).toBe("a&lt;b&gt;&amp;&quot;c&#39;");
  });
});
