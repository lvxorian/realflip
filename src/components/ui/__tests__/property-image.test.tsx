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

describe("ImageGallery — pevný box 8:5, blur pruhy, fotka bez ořezu", () => {
  it("hlavní fotka má object-contain a rozmazané pozadí (blur pruhy) ze stejné fotky", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    expect(main.getAttribute("src")).toBe("/a.jpg");
    expect(main.className).toContain("object-contain");

    const bg = document.querySelector('img[aria-hidden="true"]');
    expect(bg).toBeTruthy();
    expect(bg?.getAttribute("src")).toBe("/a.jpg");
    expect(bg?.className).toContain("object-cover");
    expect(bg?.className).toContain("blur");
  });

  it("kontejner má pevný poměr 8:5 a fotka ho nemění (žádná deformace layoutu)", () => {
    render(<ImageGallery images={["/a.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    const container = main.closest("div");
    expect(container?.className).toContain("aspect-[8/5]");

    // simuluj načtení extrémně široké fotky (4000x1000) — box zůstává 8:5
    Object.defineProperty(main, "naturalWidth", { value: 4000 });
    Object.defineProperty(main, "naturalHeight", { value: 1000 });
    fireEvent.load(main);
    expect(container?.className).toContain("aspect-[8/5]");
  });

  it("šipky listují mezi fotkami", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByLabelText("Dalsi fotka"));

    expect(screen.getByAltText("Byt - foto 2").getAttribute("src")).toBe("/b.jpg");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("boční zóny šipek pokrývají celou výšku (klik neuteče při změně velikosti)", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    const prev = screen.getByLabelText("Predchozi fotka");
    const next = screen.getByLabelText("Dalsi fotka");
    // tlačítko zabírá celou výšku kontejneru (inset-y-0), ne jen střed
    expect(prev.className).toContain("inset-y-0");
    expect(prev.className).toContain("left-0");
    expect(next.className).toContain("inset-y-0");
    expect(next.className).toContain("right-0");
    // kliknutí kamkoli do zóny listuje
    fireEvent.click(prev);
    expect(screen.getByAltText("Byt - foto 2").getAttribute("src")).toBe("/b.jpg");
    fireEvent.click(next);
    expect(screen.getByAltText("Byt - foto 1").getAttribute("src")).toBe("/a.jpg");
  });

  it("klávesové šipky → listují mezi fotkami včetně cyklení", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg", "/c.jpg"]} alt="Byt" />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText("Byt - foto 2").getAttribute("src")).toBe("/b.jpg");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText("Byt - foto 3").getAttribute("src")).toBe("/c.jpg");

    // konec → zpět na první
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText("Byt - foto 1").getAttribute("src")).toBe("/a.jpg");

    // ← z první → na poslední
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByAltText("Byt - foto 3").getAttribute("src")).toBe("/c.jpg");
  });

  it("při psaní do inputu šipky nelistují", () => {
    render(
      <>
        <ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />
        <input aria-label="test input" />
      </>
    );

    fireEvent.keyDown(screen.getByLabelText("test input"), { key: "ArrowRight" });

    expect(screen.getByAltText("Byt - foto 1").getAttribute("src")).toBe("/a.jpg");
  });

  it("u jediné fotky se šipkami nic neděje", () => {
    render(<ImageGallery images={["/a.jpg"]} alt="Byt" />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });

    expect(screen.getByAltText("Byt - foto 1").getAttribute("src")).toBe("/a.jpg");
  });

  it("fullscreen tlačítko je dole uprostřed nad počtem fotek (nekoliduje se šipkou vpravo)", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    const btn = screen.getByLabelText("Zobrazit na celou obrazovku");
    expect(btn.className).toContain("bottom-14");
    expect(btn.className).toContain("left-1/2");
    expect(btn.className).toContain("-translate-x-1/2");
    // není vpravo dole (kde je šipka „další fotka")
    expect(btn.className).not.toContain("right-3");
  });

  it("bez fotek zobrazí placeholder bez fotky", () => {
    render(<ImageGallery images={[]} alt="Byt" />);

    expect(document.querySelectorAll("img").length).toBe(0);
  });
});

describe("ImageGallery — fullscreen", () => {
  it("tlačítko otevře fotku na celou obrazovku a křížek ji zavře", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByLabelText("Zobrazit na celou obrazovku"));

    expect(screen.getByAltText("Byt - fullscreen 1")).toBeTruthy();
    expect(screen.getByLabelText("Zavřít fullscreen")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zavřít fullscreen"));
    expect(screen.queryByAltText("Byt - fullscreen 1")).toBeNull();
  });

  it("ve fullscreenu listují šipky doleva/doprava", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByLabelText("Zobrazit na celou obrazovku"));
    expect(screen.getByAltText("Byt - fullscreen 1").getAttribute("src")).toBe("/a.jpg");

    fireEvent.click(screen.getByLabelText("Dalsi fotka fullscreen"));
    expect(screen.getByAltText("Byt - fullscreen 2").getAttribute("src")).toBe("/b.jpg");

    fireEvent.click(screen.getByLabelText("Predchozi fotka fullscreen"));
    expect(screen.getByAltText("Byt - fullscreen 1").getAttribute("src")).toBe("/a.jpg");
  });

  it("Esc zavře fullscreen", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByLabelText("Zobrazit na celou obrazovku"));
    expect(screen.getByAltText("Byt - fullscreen 1")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByAltText("Byt - fullscreen 1")).toBeNull();
  });

  it("klik na pozadí zavře fullscreen, klik na fotku ne", () => {
    render(<ImageGallery images={["/a.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByLabelText("Zobrazit na celou obrazovku"));
    const photo = screen.getByAltText("Byt - fullscreen 1");

    fireEvent.click(photo);
    expect(screen.getByAltText("Byt - fullscreen 1")).toBeTruthy();

    fireEvent.click(photo.parentElement!);
    expect(screen.queryByAltText("Byt - fullscreen 1")).toBeNull();
  });
});
