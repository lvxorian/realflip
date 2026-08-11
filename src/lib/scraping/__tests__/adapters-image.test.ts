import { describe, it, expect } from "vitest";
import { filterImages, toFullSizeImageUrl, cleanHtmlToText } from "../types";

describe("cleanHtmlToText", () => {
  it("převede <br /> a CRLF na jeden nový řádek, odstraní ostatní tagy", () => {
    const out = cleanHtmlToText("První věta.<br />\r\nDruhá věta. <p>Odstavec</p>");
    expect(out).toBe("První věta.\nDruhá věta. Odstavec");
    expect(out).not.toContain("<");
  });

  it("dekóduje HTML entity a sbalí mezery", () => {
    const out = cleanHtmlToText("A &amp; B &lt; 10 &nbsp;min&quot;");
    expect(out).toBe("A & B < 10 min\"");
  });

  it("je idempotentní pro čistý text (bez tagů)", () => {
    const text = "Obyčejný popis bez HTML.";
    expect(cleanHtmlToText(text)).toBe(text);
  });

  it("null/undefined → null, prázdný → null", () => {
    expect(cleanHtmlToText(null)).toBeNull();
    expect(cleanHtmlToText(undefined)).toBeNull();
    expect(cleanHtmlToText("<br />")).toBeNull();
  });
});

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

  it("dedupuje duplicitní URL", () => {
    const result = filterImages(
      ["https://valid.com/photo.jpg", "https://valid.com/photo.jpg", "https://valid.com/other.jpg"],
      "sreality"
    );
    expect(result).toEqual(["https://valid.com/photo.jpg", "https://valid.com/other.jpg"]);
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

  it("přidá base URL pro realitymat", () => {
    const result = filterImages(["/crop/480x360/1234/5678.webp"], "realitymat");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://www.realitymat.cz/crop/480x360/1234/5678.webp");
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

describe("toFullSizeImageUrl", () => {
  it("annonce thumbnail → full-size (odstrani _N priponu)", () => {
    const url = "https://static.annonce.cz/attachment/127/254/508/744589889_744589891.jpg";
    expect(toFullSizeImageUrl(url, "annonce")).toBe(
      "https://static.annonce.cz/attachment/127/254/508/744589889.jpg"
    );
  });

  it("annonce s query stringem → full-size bez query", () => {
    const url = "https://static.annonce.cz/attachment/127/254/508/744589889_744589891.jpg?Zrekonstruovany-1%2B1-v-OV";
    expect(toFullSizeImageUrl(url, "annonce")).toBe(
      "https://static.annonce.cz/attachment/127/254/508/744589889.jpg"
    );
  });

  it("annonce uz full-size URL beze zmeny", () => {
    const url = "https://static.annonce.cz/attachment/127/254/508/744589889.jpg";
    expect(toFullSizeImageUrl(url, "annonce")).toBe(url);
  });

  it("png pripona se take transformuje", () => {
    const url = "https://static.annonce.cz/attachment/12/34/56/9999_8888.png";
    expect(toFullSizeImageUrl(url, "annonce")).toBe(
      "https://static.annonce.cz/attachment/12/34/56/9999.png"
    );
  });

  it("jiny portal = vstup beze zmeny", () => {
    const url = "https://n2.cz/photo/12345_999.jpg";
    expect(toFullSizeImageUrl(url, "sreality")).toBe(url);
  });

  it("annonce mimo /attachment/ = vstup beze zmeny", () => {
    const url = "https://www.annonce.cz/public/e5/5/57/3449_55378_facebook.png";
    expect(toFullSizeImageUrl(url, "annonce")).toBe(url);
  });
});
