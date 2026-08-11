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

describe("PropertyImage — celá fotka bez ořezu", () => {
  it("vyrendruje rozmazané pozadí (aria-hidden) + hlavní fotku s object-contain", () => {
    render(<PropertyImage src="/foto.jpg" alt="Byt 2+kk" containerClassName="h-40 w-full" />);

    // aria-hidden pozadí je mimo strom přístupnosti — přístupných img je jen hlavní fotka
    expect(screen.queryAllByRole("img").length).toBe(1);
    const main = screen.getByRole("img");
    expect(main.getAttribute("src")).toBe("/foto.jpg");
    expect(main.className).toContain("object-contain");
    expect(main.className).not.toContain("object-cover");

    // pozadí existuje a má stejný zdroj + blur
    const backdrops = document.querySelectorAll('img[aria-hidden="true"]');
    expect(backdrops.length).toBe(1);
    expect(backdrops[0].getAttribute("src")).toBe("/foto.jpg");
    expect(backdrops[0].className).toContain("object-cover");
    expect(backdrops[0].className).toContain("blur-lg");
  });

  it("fit=\"cover\" zachová ořez pro malé miniatury (bez pozadí)", () => {
    render(
      <PropertyImage src="/foto.jpg" alt="Miniatura" fit="cover" containerClassName="h-14 w-20" />
    );

    expect(screen.getByRole("img").className).toContain("object-cover");
    expect(document.querySelectorAll('img[aria-hidden="true"]').length).toBe(0);
  });

  it("při chybě načtení zobrazí fallback (domeček) místo fotky", () => {
    render(<PropertyImage src="/chyba.jpg" alt="Byt" containerClassName="h-40 w-full" />);

    const img = screen.getByRole("img");
    fireEvent.error(img);

    // fallback text/ikonu nemáme snadno zacílit — ověříme, že fotky zmizely
    expect(document.querySelectorAll("img").length).toBe(0);
  });

  it("odstraněný inzerát nenačítá žádný obrázek", () => {
    render(<PropertyImage src="/foto.jpg" alt="Byt" removed containerClassName="h-40 w-full" />);

    expect(document.querySelectorAll("img").length).toBe(0);
    expect(screen.getByText("Inzerát odstraněn")).toBeTruthy();
  });

  it("bez zdroje zobrazí fallback místo fotky", () => {
    render(<PropertyImage src={null} alt="Byt" containerClassName="h-40 w-full" />);

    expect(document.querySelectorAll("img").length).toBe(0);
  });
});

describe("ImageGallery — hlavní fotka celá, bez ořezu shora/zdola", () => {
  it("hlavní fotka má object-contain a pozadí blur-2xl", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    expect(main.getAttribute("src")).toBe("/a.jpg");
    expect(main.className).toContain("object-contain");

    const backdrops = document.querySelectorAll('img[aria-hidden="true"]');
    expect(backdrops.length).toBe(1);
    expect(backdrops[0].className).toContain("blur-2xl");
  });

  it("šipky listují a pozadí i hlavní fotka se přepnou na další obrázek", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByLabelText("Dalsi fotka"));

    expect(screen.getByAltText("Byt - foto 2").getAttribute("src")).toBe("/b.jpg");
    const backdrops = document.querySelectorAll('img[aria-hidden="true"]');
    expect(backdrops[0].getAttribute("src")).toBe("/b.jpg");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});
