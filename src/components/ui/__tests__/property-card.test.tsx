import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertyCard } from "../property-card";

// jsdom nemá IntersectionObserver — ScoreGauge (framer-motion useInView) ho vyžaduje.
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

const base = {
  id: "p1",
  title: "Byt 2+kk Praha",
  price: 5_000_000,
  address: "Praha 1",
  score: 70,
};

describe("PropertyCard — mini carousel fotek", () => {
  it("ukáže šipky a pozici i/N, když má nemovitost více fotek", () => {
    render(<PropertyCard {...base} imageUrls={["/a.jpg", "/b.jpg", "/c.jpg"]} />);

    expect(screen.getByLabelText("Předchozí foto")).toBeTruthy();
    expect(screen.getByLabelText("Další foto")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toBe("/a.jpg");
  });

  it("šipka doprava přelistuje na další foto a aktualizuje pozici", () => {
    render(<PropertyCard {...base} imageUrls={["/a.jpg", "/b.jpg"]} />);

    fireEvent.click(screen.getByLabelText("Další foto"));

    expect(screen.getByRole("img").getAttribute("src")).toBe("/b.jpg");
    expect(screen.getByText("2/2")).toBeTruthy();
  });

  it("šipka doleva cykluje zpět na poslední foto", () => {
    render(<PropertyCard {...base} imageUrls={["/a.jpg", "/b.jpg"]} />);

    fireEvent.click(screen.getByLabelText("Předchozí foto"));

    expect(screen.getByRole("img").getAttribute("src")).toBe("/b.jpg");
    expect(screen.getByText("2/2")).toBeTruthy();
  });

  it("nezobrazí šipky, když je jen jedna fotka", () => {
    render(<PropertyCard {...base} imageUrls={["/a.jpg"]} />);

    expect(screen.queryByLabelText("Další foto")).toBeNull();
    expect(screen.queryByLabelText("Předchozí foto")).toBeNull();
    expect(screen.getByRole("img").getAttribute("src")).toBe("/a.jpg");
  });

  it("nezobrazí šipky u odstraněného inzerátu", () => {
    render(<PropertyCard {...base} imageUrls={["/a.jpg", "/b.jpg"]} removed />);

    expect(screen.queryByLabelText("Další foto")).toBeNull();
    expect(screen.queryByLabelText("Předchozí foto")).toBeNull();
    expect(screen.getByText("Inzerát odstraněn")).toBeTruthy();
  });

  it("zobrazí dispozici PŘED plochou jako výrazné chipy", () => {
    render(<PropertyCard {...base} area="49.2 m²" rooms="2+kk" />);

    const rooms = screen.getByText("2+kk");
    const area = screen.getByText("49.2 m²");
    // oba jsou chipy s pozadím
    expect(rooms.className).toContain("bg-card-hover");
    expect(area.className).toContain("bg-card-hover");
    // dispozice je v DOM pořadí PŘED plochou
    expect(rooms.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
