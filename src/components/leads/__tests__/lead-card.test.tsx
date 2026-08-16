import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    propertyImageUrls: [],
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
    portalStatus: null,
    portalReservedInvestorId: null,
    portalReservedModel: null,
    portalReservedStrategy: null,
    portalExpiresAt: null,
    ...overrides,
  };
}

describe("LeadCardView — klíčové údaje jsou vždy vidět (i v úzkém sloupci)", () => {
  it("zobrazí ulici i město na jednom řádku", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.getByText("Poděbradova 2842/1, Jižní Předměstí")).toBeTruthy();
    expect(screen.queryByText("Jižní Předměstí")).toBeNull();
  });

  it("zobrazí cenu za m² vedle ceny", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.getByText("51 tis. Kč/m²")).toBeTruthy();
    // nesmí se skrývat v úzkém sloupci
    const sqm = screen.getByText("51 tis. Kč/m²");
    expect(sqm.className).not.toContain("@max-[240px]:hidden");
  });

  it("nezobrazuje ARV, kontakt, stav ani typ budovy, ani relativní čas aktivity", () => {
    const lead = makeLead({
      analysisArv: 3_500_000,
      propertyCondition: "before_renovation",
      propertyBuildingType: "panel",
      contactName: "Michaela Tripalova",
      contactPhone: "+420 777 123 456",
      contactEmail: "m@example.com",
    });
    render(<LeadCardView lead={lead} onOpen={() => {}} />);

    expect(screen.queryByText(/ARV:/)).toBeNull();
    expect(screen.queryByText("Michaela Tripalova")).toBeNull();
    expect(screen.queryByText(/Před rekonstrukcí/i)).toBeNull();
    expect(screen.queryByText(/Panelový/i)).toBeNull();
    expect(screen.queryByText(formatRelative(lead.updatedAt!))).toBeNull();
  });

  it("nezobrazuje dobu na trhu ani badge m²/dispozice (jsou v nadpisu)", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.queryByText(/na trhu/i)).toBeNull();
    expect(screen.queryByText("49 m²")).toBeNull();
    // „2+kk“ nesmí být samostatný badge (v nadpisu je, ale to je jiný element)
    expect(screen.queryAllByText("2+kk").length).toBe(0);
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

  it("poznámka se omezí na dva řádky (line-clamp-2), aby karta zůstala nízká", () => {
    const longNote =
      "Dlouhá poznámka, která by se dřív ořezala na dva řádky a skončila třemi tečkami. " +
      "Majitel je ochotný slevit, ale chce vidět vážnou nabídku do konce týdne. " +
      "Ideálně se domluvit na prohlídce v sobotu dopoledne, klíče má u sousedky.";
    render(<LeadCardView lead={makeLead({ notes: longNote })} onOpen={() => {}} />);

    const note = screen.getByText(longNote);
    expect(note.className).toContain("line-clamp-2");
  });

  it("pod inzertní cenou zobrazí přesně číslo ideální kupní ceny z kalkulace a její m²", () => {
    render(<LeadCardView lead={makeLead({ propertyArea: 49, analysisTargetPurchasePrice: 2_000_000 })} onOpen={() => {}} />);

    expect(screen.getByText("Ideální: 2 000 000 Kč")).toBeTruthy();
    expect(screen.getByText("41 tis. Kč/m²")).toBeTruthy();
  });

  it("prompt pro Vyjednáno zobrazí rovnou vstup pro cenu a Enter ji odešle", () => {
    const onAgree = vi.fn();
    render(
      <LeadCardView
        lead={makeLead({ stage: "negotiation", analysisTargetPurchasePrice: 2_000_000 })}
        onOpen={() => {}}
        negotiationPrompt
        onAgree={onAgree}
        onAgreeCancel={() => {}}
      />
    );

    const input = screen.getByPlaceholderText("2000000");
    fireEvent.change(input, { target: { value: "1950000" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAgree).toHaveBeenCalledWith(expect.objectContaining({ id: "lead-1" }), 1950000);
  });

  it("drag preview ukazuje stejné klíčové údaje jako karta", () => {
    render(<LeadCardView lead={makeLead()} onOpen={() => {}} />);

    expect(screen.getByText("Poděbradova 2842/1, Jižní Předměstí")).toBeTruthy();
    expect(screen.getByText("51 tis. Kč/m²")).toBeTruthy();
  });
});
