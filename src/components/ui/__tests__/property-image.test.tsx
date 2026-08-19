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

describe("ImageGallery — pevný box 8:5, fit podle poměru stran", () => {
  it("fotka na šířku vyplní celý box (object-cover, žádné pruhy)", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    expect(main.getAttribute("src")).toBe("/a.jpg");
    // poměr 4:1 (na šířku) → object-cover
    Object.defineProperty(main, "naturalWidth", { value: 4000 });
    Object.defineProperty(main, "naturalHeight", { value: 1000 });
    fireEvent.load(main);
    expect(main.className).toContain("object-cover");
    expect(main.className).not.toContain("object-contain");
  });

  it("fotka na výšku zůstane celá (object-contain) s blur pruhy po stranách", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    expect(main.getAttribute("src")).toBe("/a.jpg");
    // poměr 3:4 (na výšku) → object-contain, ne ořez
    Object.defineProperty(main, "naturalWidth", { value: 600 });
    Object.defineProperty(main, "naturalHeight", { value: 800 });
    fireEvent.load(main);
    expect(main.className).toContain("object-contain");
    expect(main.className).not.toContain("object-cover");

    const bg = document.querySelector('img[aria-hidden="true"]');
    expect(bg).toBeTruthy();
    expect(bg?.getAttribute("src")).toBe("/a.jpg");
    expect(bg?.className).toContain("object-cover");
    expect(bg?.className).toContain("blur");
  });

  it("kontejner má pevný poměr 8:5 a fotka ho nemění (žádná deformace layoutu)", () => {
    render(<ImageGallery images={["/a.jpg"]} alt="Byt" />);

    const main = screen.getByAltText("Byt - foto 1");
    const container = main.closest('div[class*="aspect-[8/5]"]');
    expect(container?.className).toContain("aspect-[8/5]");

    // simuluj načtení extrémně široké fotky (4000x1000) — box zůstává 8:5
    Object.defineProperty(main, "naturalWidth", { value: 4000 });
    Object.defineProperty(main, "naturalHeight", { value: 1000 });
    fireEvent.load(main);
    expect(container?.className).toContain("aspect-[8/5]");
  });

  it("immersiveOnMobile přidá mobilní imerzivní výšku (52dvh), desktop zůstává 8:5", () => {
    const { container } = render(<ImageGallery images={["/a.jpg"]} alt="Byt" immersiveOnMobile />);
    const box = container.querySelector('div[class*="aspect-[8/5]"]');
    expect(box?.className).toContain("max-lg:h-[52dvh]");
  });

  it("swipe doleva listuje na další fotku (nativní gesto)", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);
    const img = screen.getByAltText("Byt - foto 1");

    fireEvent.pointerDown(img, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerMove(img, { pointerType: "touch", clientX: 150, clientY: 100 });
    fireEvent.pointerUp(img, { pointerType: "touch", clientX: 150, clientY: 100 });

    expect(screen.getByAltText("Byt - foto 2").getAttribute("src")).toBe("/b.jpg");
  });

  it("malý swipe (pod prahem) fotku nezmění", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);
    const img = screen.getByAltText("Byt - foto 1");

    fireEvent.pointerDown(img, { pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(img, { pointerType: "touch", clientX: 180, clientY: 100 });
    fireEvent.pointerUp(img, { pointerType: "touch", clientX: 180, clientY: 100 });

    expect(screen.getByAltText("Byt - foto 1").getAttribute("src")).toBe("/a.jpg");
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

  it("fullscreen ikonka už neexistuje — místo ní se otevře klikem na fotku", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    expect(screen.queryByLabelText("Zobrazit na celou obrazovku")).toBeNull();
    expect(document.querySelector('[title="Zobrazit na celou obrazovku"]')).toBeNull();
  });

  it("bez fotek zobrazí placeholder bez fotky", () => {
    render(<ImageGallery images={[]} alt="Byt" />);

    expect(document.querySelectorAll("img").length).toBe(0);
  });
});

describe("ImageGallery — fullscreen", () => {
  it("klik na fotku otevře fullscreen a křížek ho zavře", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByAltText("Byt - foto 1"));

    expect(screen.getByAltText("Byt - fullscreen 1")).toBeTruthy();
    expect(screen.getByLabelText("Zavřít fullscreen")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Zavřít fullscreen"));
    expect(screen.queryByAltText("Byt - fullscreen 1")).toBeNull();
  });

  it("ve fullscreenu listují šipky doleva/doprava", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByAltText("Byt - foto 1"));
    expect(screen.getByAltText("Byt - fullscreen 1").getAttribute("src")).toBe("/a.jpg");

    fireEvent.click(screen.getByLabelText("Dalsi fotka fullscreen"));
    expect(screen.getByAltText("Byt - fullscreen 2").getAttribute("src")).toBe("/b.jpg");

    fireEvent.click(screen.getByLabelText("Predchozi fotka fullscreen"));
    expect(screen.getByAltText("Byt - fullscreen 1").getAttribute("src")).toBe("/a.jpg");
  });

  it("Esc zavře fullscreen", () => {
    render(<ImageGallery images={["/a.jpg", "/b.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByAltText("Byt - foto 1"));
    expect(screen.getByAltText("Byt - fullscreen 1")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByAltText("Byt - fullscreen 1")).toBeNull();
  });

  it("klik na pozadí zavře fullscreen, klik na fotku ne", () => {
    render(<ImageGallery images={["/a.jpg"]} alt="Byt" />);

    fireEvent.click(screen.getByAltText("Byt - foto 1"));
    const photo = screen.getByAltText("Byt - fullscreen 1");

    fireEvent.click(photo);
    expect(screen.getByAltText("Byt - fullscreen 1")).toBeTruthy();

    fireEvent.click(photo.parentElement!);
    expect(screen.queryByAltText("Byt - fullscreen 1")).toBeNull();
  });
});
