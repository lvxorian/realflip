import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InteractiveAnalysis from "../interactive-analysis";
import PropertyDetailAnalysis from "../property-detail-analysis";

beforeAll(() => {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error test stub
  globalThis.IntersectionObserver = IO;
  globalThis.ResizeObserver = IO;
  (window as { matchMedia?: unknown }).matchMedia =
    (window as { matchMedia?: unknown }).matchMedia ??
    (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function baseResult(listingId?: string) {
  return {
    url: "https://example.com/inzerat",
    portal: "sreality",
    success: true,
    listing: {
      id: listingId ?? undefined,
      title: "Byt 3+1 Cheb",
      price: 2800000,
      area: 70,
      rooms: "3+1",
      condition: "good",
      address: "Cheb",
      description: "Prostorný byt v centru.",
      imageUrls: [] as string[],
      contactPhone: null,
      contactName: null,
      contactEmail: null,
    },
    analysis: {
      pricePerSqm: 40000,
      marketPricePerSqmLow: 35000,
      marketPricePerSqmHigh: 45000,
      arvPricePerSqmHigh: 45000,
      marketSource: "db",
      marketSampleSize: 12,
      undervaluationPct: 10,
      overpricingPct: 0,
      investmentScore: 75,
      verdictLevel: "buy",
      recommendation: "buy",
      verdictSummary: "Dobrý kandidát.",
      arv: 3300000,
      roi: 16.5,
      netProfit: 400000,
      targetPurchasePrice: 2700000,
      priceReductionNeeded: 0,
      priceReductionPct: 0,
      condition: "good",
      location: { city: "Cheb", category: "stable" },
      buildingType: "panel",
      segmentRating: "B",
      occupancy: "free",
      missingFields: [] as string[],
      redFlags: [] as { type: string; text: string; severity: string }[],
      scenarios: {},
    },
    aiSummary: null,
    aiNegotiationTips: null,
    aiComparableNotes: null,
    aiHiddenInfo: null,
  };
}

describe("AI Hodnocení (on-demand)", () => {
  it("zobrazí tlačítko Generovat AI hodnocení a po kliknutí zobrazí report", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/properties/p1/ai-analysis") {
        return new Response(
          JSON.stringify({
            success: true,
            summary: "Silný investiční kandidát v dobré lokalitě.",
            sentiment: "urgent",
            maxBid: 2500000,
            negotiationTips: ["Poukázat na starou koupelnu."],
            redFlags: ["Popis je krátký."],
            hiddenInfo: ["Ověřit energetický štítek."],
            comparableNotes: "V lokalitě se prodává za 3,1–3,4 mil. Kč.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InteractiveAnalysis result={baseResult("p1")} index={0} />);

    const button = await screen.findByText("Generovat AI hodnocení");
    fireEvent.click(button);

    expect(await screen.findByText("Silný investiční kandidát v dobré lokalitě.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/properties/p1/ai-analysis", expect.objectContaining({ method: "POST" }));
    // maxBid
    expect(screen.getByText("Max. nabídka pro 15 % ROI")).toBeTruthy();
  });

  it("nezobrazí tlačítko, když nemovitost není v DB (bez id)", () => {
    render(<InteractiveAnalysis result={baseResult(undefined)} index={0} />);
    expect(screen.queryByText("Generovat AI hodnocení")).toBeNull();
  });

  it("zobrazí uložený aiReport z DB (parsování JSONu v PropertyDetailAnalysis)", () => {
    const property = {
      id: "p1",
      title: "Byt 3+1 Cheb",
      price: 2800000,
      pricePerSqm: 40000,
      area: 70,
      rooms: "3+1",
      floor: null,
      condition: "good",
      buildingType: "panel",
      yearBuilt: null,
      address: "Cheb",
      lat: null,
      lng: null,
      contactPhone: null,
      contactName: null,
      contactEmail: null,
      description: "Prostorný byt v centru.",
      imageUrls: [] as string[],
      url: "https://example.com/inzerat",
      portalName: "sreality",
    };
    const analysis = {
      id: "a1",
      marketValue: 3000000,
      undervaluationPct: 10,
      investmentScore: 75,
      arv: 3300000,
      renovationCost: 400000,
      totalCost: 3100000,
      netProfit: 400000,
      roi: 16.5,
      annualizedRoi: 8.2,
      cashOnCash: 12,
      breakEvenPrice: 2600000,
      recommendation: "buy",
      pricePerSqm: 40000,
      marketPriceMin: 35000,
      marketPriceMax: 45000,
      overpricingPct: 0,
      locationCategory: "stable",
      locationCity: "Cheb",
      locationDistrict: null,
      segmentRating: "B",
      occupancy: "free",
      buildingType: "panel",
      energyLabel: null,
      technicalScore: 70,
      verdictLevel: "buy",
      verdictSummary: "Dobrý kandidát.",
      redFlagsJson: "[]",
      costsJson: "{}",
      alternativeStrategiesJson: "[]",
      rentalYield: 5.2,
      aiReport: JSON.stringify({
        summary: "Uložené AI hodnocení z dřívějška.",
        sentiment: "neutral",
        maxBid: 2600000,
        negotiationTips: ["Tip z DB."],
        redFlags: [],
        hiddenInfo: ["Skrytá informace z DB."],
        comparableNotes: "Srovnání z DB.",
      }),
      marketSource: "db",
      marketSampleSize: 12,
    };

    render(
      <PropertyDetailAnalysis property={property as any} analysis={analysis as any} />
    );

    expect(screen.getByText("Uložené AI hodnocení z dřívějška.")).toBeTruthy();
    expect(screen.getByText("Tip z DB.")).toBeTruthy();
    // Uložený report → žádné tlačítko
    expect(screen.queryByText("Generovat AI hodnocení")).toBeNull();
  });
});
