import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadCardView } from "../lead-card";
import { formatRelative } from "@/lib/utils";
import type { LeadItem } from "../types";

// jsdom nemá IntersectionObserver (potřebuje ho ScoreGauge).
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
});

const DAY_MS = 86_400_000;

function makeLead(overrides: Partial<LeadItem> = {}): LeadItem {
  return {
    id: "lead-1",
    dealId: null,
    stage: "new",
    priority: 0,
    notes: null,
    assignedTo: null,
    stageData: null,
    position: 0,
    stageEnteredAt: Date.now() - DAY_MS,
    lostReason: null,
    nextStep: null,
    nextStepDueAt: null,
    createdAt: Date.now() - DAY_MS,
    updatedAt: Date.now() - 3_600_000,
    propertyId: "prop-1",
    propertyTitle: "Prodej, byt 2+kk",
    propertyPrice: 2_500_000,
    propertyPricePerSqm: 51_000,
    // o hodinu starší, ať je floor((now − firstSeen)/den) stabilně 10 i přes pár ms
    propertyFirstSeen: Date.now() - 10 * DAY_MS - 3_600_000,
    propertyArea: 49,
    propertyRooms: "2+kk",
    propertyAddress: "Poděbradova 2842/1, Jižní Předměstí",
    propertyCondition: null,
    propertyBuildingType: null,
    propertyYearBuilt: null,
    propertyPortalName: "sreality",
    propertyUrl: null,
    propertyImageUrl: null,
    propertyRemoved: false,
    propertyIsActive: true,
    propertyRemovedAt: null,
    contactId: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    analysisScore: null,
    analysisArv: null,
    analysisTargetPurchasePrice: null,
    ...overrides,
  };
}

describe("LeadCardView — klíčové údaje jsou vždy vidět (i v úzkém sloupci)", () => {
  it("zobrazí ulici i město na samostatných řádcích", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.getByText("Poděbradova 2842/1")).toBeTruthy();
    expect(screen.getByText("Jižní Předměstí")).toBeTruthy();
  });

  it("zobrazí cenu za m² vedle ceny", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.getByText("51 tis. Kč/m²")).toBeTruthy();
    // nesmí se skrývat v úzkém sloupci
    const sqm = screen.getByText("51 tis. Kč/m²");
    expect(sqm.className).not.toContain("@max-[240px]:hidden");
  });

  it("zobrazí dobu na trhu z first_seen", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.getByText("10 dní na trhu")).toBeTruthy();
  });

  it("bez first_seen zůstává relativní čas poslední aktivity", () => {
    const lead = makeLead({ propertyFirstSeen: null });
    render(<LeadCardView lead={lead} onOpen={() => {}} />);

    const expected = formatRelative(lead.updatedAt!);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("adresa bez čárky se zobrazí celá jako ulice", () => {
    render(<LeadCardView lead={makeLead({ propertyAddress: "Vašátkova 16 Praha" })} onOpen={() => {}} />);

    expect(screen.getByText("Vašátkova 16 Praha")).toBeTruthy();
  });

  it("adresa jen s městem a PSČ nemá prázdný řádek města", () => {
    render(<LeadCardView lead={makeLead({ propertyAddress: "Brno, 614 00" })} onOpen={() => {}} />);

    expect(screen.getByText("Brno")).toBeTruthy();
    expect(screen.queryByText("614 00")).toBeNull();
  });

  it("drag preview ukazuje stejné klíčové údaje jako karta", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.getByText("Poděbradova 2842/1")).toBeTruthy();
    expect(screen.getByText("Jižní Předměstí")).toBeTruthy();
    expect(screen.getByText("51 tis. Kč/m²")).toBeTruthy();
    expect(screen.getByText("10 dní na trhu")).toBeTruthy();
  });
});
