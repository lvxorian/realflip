import { describe, it, expect } from "vitest";
import { extractAreaFromDescription, extractPdfLinks, extractSlug, isPortaldrazebUrl } from "../parse-auction";

describe("extractAreaFromDescription", () => {
  it("extracts area from 'užitná plocha ... X m²'", () => {
    expect(
      extractAreaFromDescription("Jedná se o bytovou jednotku 1+1 o užitné ploše 38,2 m² ve 4. NP.")
    ).toBe(38);
  });

  it("extracts integer area", () => {
    expect(
      extractAreaFromDescription("Užitná plocha jednotky je 38 m2.")
    ).toBe(38);
  });

  it("extracts area when number precedes keyword", () => {
    expect(
      extractAreaFromDescription("Byt 45 m2 užitné plochy v cihle.")
    ).toBe(45);
  });

  it("extracts generic plocha pattern", () => {
    expect(
      extractAreaFromDescription("Plocha nemovitosti je 82 m2.")
    ).toBe(82);
  });

  it("ignores too-large values (building totals)", () => {
    // Plocha pozemku 3700 m² by neměla být použita jako plocha jednotky
    expect(
      extractAreaFromDescription("Celková plocha pozemku je 3700 m2. Užitná plocha jednotky je 38 m2.")
    ).toBe(38);
  });

  it("returns null when no area present", () => {
    expect(extractAreaFromDescription("Nemovitost v dobrém stavu, cihlová konstrukce.")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(extractAreaFromDescription(null)).toBeNull();
    expect(extractAreaFromDescription("")).toBeNull();
  });
});

describe("extractSlug", () => {
  it("extracts slug from /drazba/ URL", () => {
    expect(extractSlug("https://www.portaldrazeb.cz/drazba/146ex887-23-112-poner")).toBe("146ex887-23-112-poner");
  });

  it("extracts slug from /detail/ URL", () => {
    expect(extractSlug("https://www.portaldrazeb.cz/detail/abc123")).toBe("abc123");
  });

  it("returns null for invalid URL", () => {
    expect(extractSlug("https://example.com/other")).toBeNull();
  });
});

describe("extractPdfLinks", () => {
  it("builds correct public download URLs and maps document types", () => {
    const data = {
      documents: {
        aaa11: {
          mime_type: "application/pdf",
          hash: "aaa11",
          document_type: "auction_decree",
          original_name: "DV.pdf",
        },
        bbb22: {
          mime_type: "application/pdf",
          hash: "bbb22",
          document_type: "expert_report",
          original_name: "ZP.pdf",
        },
      },
    };
    const docs = extractPdfLinks(data as never);
    expect(docs).toEqual([
      { type: "vyhlaska", url: "https://www.portaldrazeb.cz/upload/auction-document/aaa11" },
      { type: "posudek", url: "https://www.portaldrazeb.cz/upload/auction-document/bbb22" },
    ]);
  });

  it("skips non-PDF documents and unknown types", () => {
    const data = {
      documents: {
        img1: { mime_type: "image/jpeg", hash: "img1", document_type: "other_doc" },
        pdf3: { mime_type: "application/pdf", hash: "pdf3", document_type: "resolution_pre" },
      },
    };
    const docs = extractPdfLinks(data as never);
    expect(docs).toEqual([
      { type: "other", url: "https://www.portaldrazeb.cz/upload/auction-document/pdf3" },
    ]);
  });

  it("prioritizes vyhlaska before posudek", () => {
    const data = {
      documents: {
        expert1: { mime_type: "application/pdf", hash: "expert1", document_type: "expert_report" },
        decree1: { mime_type: "application/pdf", hash: "decree1", document_type: "auction_decree" },
      },
    };
    const docs = extractPdfLinks(data as never);
    expect(docs.map((d) => d.type)).toEqual(["vyhlaska", "posudek"]);
  });

  it("falls back to document key when hash is missing", () => {
    const data = {
      documents: {
        fallbackKey: { mime_type: "application/pdf", document_type: "auction_decree" },
      },
    };
    const docs = extractPdfLinks(data as never);
    expect(docs).toEqual([
      { type: "vyhlaska", url: "https://www.portaldrazeb.cz/upload/auction-document/fallbackKey" },
    ]);
  });

  it("returns empty array when no documents", () => {
    expect(extractPdfLinks({} as never)).toEqual([]);
    expect(extractPdfLinks({ documents: {} } as never)).toEqual([]);
  });
});

describe("isPortaldrazebUrl", () => {
  it("povolí canonical i subdoménu", () => {
    expect(isPortaldrazebUrl("https://www.portaldrazeb.cz/drazba/praha-1-abc")).toBe(true);
    expect(isPortaldrazebUrl("https://portaldrazeb.cz/detail/x")).toBe(true);
    expect(isPortaldrazebUrl("https://portaldrazeb.cz/drazba/x?fbclid=1")).toBe(true);
  });

  it("odmítne subdomain-suffix útok a jiné hosty", () => {
    expect(isPortaldrazebUrl("https://myportaldrazeb.cz/drazba/x")).toBe(false);
    expect(isPortaldrazebUrl("https://evil.com/https://www.portaldrazeb.cz/drazba/x")).toBe(false);
    expect(isPortaldrazebUrl("https://portaldrazeb.cz.evil.org/drazba/x")).toBe(false);
    expect(isPortaldrazebUrl("ftp://portaldrazeb.cz/drazba/x")).toBe(false);
    expect(isPortaldrazebUrl("nesmysl")).toBe(false);
  });

  it("vyžaduje cestu /drazba/ nebo /detail/", () => {
    expect(isPortaldrazebUrl("https://www.portaldrazeb.cz/")).toBe(false);
    expect(isPortaldrazebUrl("https://www.portaldrazeb.cz/drazby/x")).toBe(false);
  });
});
