import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PropertyImage } from "../property-image";
import { ImageGallery } from "../image-gallery";

// jsdom nemá IntersectionObserver (potřebuje ho např. ScoreGauge ve vyšších komponentách).
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

describe("PropertyImage — fotka vyplní celý kontejner", () => {
  it("vyrendruje jednu fotku s object-cover (žádné pruhy, žádné pozadí)", () => {
    render(<PropertyImage src="/foto.jpg" alt="Byt 2+kk" containerClassName="aspect-[8/5] w-full" />);

    expect(screen.getAllByRole("img").length).toBe(1);
    const main = screen.getByRole("img");
    expect(main.getAttribute("src")).toBe("/foto.jpg");
    expect(main.className).toContain("object-cover");
    // žádné rozmazané pozadí navíc
    expect(document.querySelectorAll('img[aria-hidden="true"]').length).toBe(0);
  });

  it("při chybě načtení zobrazí fallback (domeček) místo fotky", () => {
    render(<PropertyImage src="/chyba.jpg" alt="Byt" containerClassName="aspect-[8/5] w-full" />);

    const img = screen.getByRole("img");
    fireEvent.error(img);

    expect(document.querySelectorAll("img").length).toBe(0);
  });

  it("odstraněný inzerát nenačítá žádný obrázek", () => {
    render(<PropertyImage src="/foto.jpg" alt="Byt" removed containerClassName="aspect-[8/5] w-full" />);

    expect(document.querySelectorAll("img").length).toBe(0);
    expect(screen.getByText("Inzerát odstraněn")).toBeTruthy();
  });

  it("bez zdroje zobrazí fallback místo fotky", () => {
    render(<PropertyImage src={null} alt="Byt" containerClassName="aspect-[8/5] w-full" />);

    expect(document.querySelectorAll("img").length).toBe(0);
  });
});

describe("ImageGallery — adaptivní poměr, fotka bez ořezu", () => {
  it("hlavní fotka má object-cover a žádné rozmazané pozadí", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    expect(main.getAttribute("src")).toBe("/a.jpg");
    expect(main.className).toContain("object-cover");
    expect(document.querySelectorAll('img[aria-hidden="true"]').length).toBe(0);
  });

  it("po načtení fotky nastaví kontejner na přirozený poměr stran", () => {
    render(<ImageGallery images={["/a.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    // výchozí (před načtením) — 8:5
    const container = main.closest("div");
    expect(container?.getAttribute("style")).toContain("8 / 5");

    // simuluj načtení 16:9 fotky (1600x900)
    Object.defineProperty(main, "naturalWidth", { value: 1600 });
    Object.defineProperty(main, "naturalHeight", { value: 900 });
    fireEvent.load(main);

    expect(container?.getAttribute("style")).toContain("1.7777777777777777");
  });

  it("extrémní poměr se zkrotí (max 2.1)", () => {
    render(<ImageGallery images={["/panorama.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    Object.defineProperty(main, "naturalWidth", { value: 4000 });
    Object.defineProperty(main, "naturalHeight", { value: 1000 });
    fireEvent.load(main);

    const container = main.closest("div");
    expect(container?.getAttribute("style")).toContain("2.1");
  });

  it("šipky listují mezi fotkami", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByLabelText("Dalsi fotka"));

    expect(screen.getByAltText("Byt - foto 2").getAttribute("src")).toBe("/b.jpg");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("bez fotek zobrazí placeholder bez fotky", () => {
    render(<ImageGallery images={[]} alt="Byt" />);

    expect(document.querySelectorAll("img").length).toBe(0);
  });
});
