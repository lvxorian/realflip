import { describe, it, expect } from "vitest";
import { filterImages } from "../types";

describe("filterImages", () => {
  it("pustí validní HTTPS URL", () => {
    const result = filterImages(["https://example.com/photo.jpg"], "sreality");
    expect(result).toHaveLength(1);
  });

  it("odstraní placeholder URL", () => {
    const result = filterImages([
      "https://example.com/nophoto.jpg",
      "https://example.com/placeholder.png",
      "https://example.com/noimage.gif",
    ], "sreality");
    expect(result).toHaveLength(0);
  });

  it("odstraní prázdné a krátké URL", () => {
    const result = filterImages(["", "abc", "https://valid.com/photo.jpg"], "sreality");
    expect(result).toHaveLength(1);
  });

  it("odstraní base64 SVG data URI", () => {
    const result = filterImages(["data:image/svg+xml;base64,PHN2Zy..."], "sreality");
    expect(result).toHaveLength(0);
  });

  it("odstraní base64 GIF placeholder", () => {
    const result = filterImages(["data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"], "sreality");
    expect(result).toHaveLength(0);
  });

  it("přidá https k protocol-relative URL", () => {
    const result = filterImages(["//cdn.example.com/photo.jpg"], "sreality");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://cdn.example.com/photo.jpg");
  });

  it("přidá base URL k root-relative URL (sreality)", () => {
    const result = filterImages(["/photo/12345.jpg"], "sreality");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.sreality.cz/photo/12345.jpg");
  });

  it("přidá base URL pro idnes-reality", () => {
    const result = filterImages(["/foto/abc.jpg"], "idnes-reality");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://reality.idnes.cz/foto/abc.jpg");
  });

  it("odstraní triple-slash URL", () => {
    const result = filterImages(["https:///bad-url.com/photo.jpg"], "sreality");
    expect(result).toHaveLength(0);
  });

  it("root-relative URL bez portalu v PORTAL_BASE_URLS = prazdny", () => {
    const result = filterImages(["/photo/123.jpg"], "neexistujici-portal");
    expect(result).toHaveLength(0);
  });
});
