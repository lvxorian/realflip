import { describe, it, expect } from "vitest";
import { brickLogoSvg, brickLogoImg } from "../investor-brick";

describe("brickLogoSvg", () => {
  it("builds an SVG with logo markers and correct size", () => {
    const svg = brickLogoSvg(32);
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="32"');
    expect(svg).toContain('viewBox="0 0 319 293"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Brickon"');
    expect(svg).toContain('data-logo="brickon"');
  });

  it("uses the white logo body", () => {
    expect(brickLogoSvg(32)).toContain('fill="#FFFFFF"');
  });

  it("includes the current logo geometry from public/brickon.svg", () => {
    const svg = brickLogoSvg(32);
    const paths = svg.match(/<path/g) ?? [];
    const rects = svg.match(/<rect/g) ?? [];
    expect(paths.length).toBe(15);
    expect(rects.length).toBe(0);
    expect(svg).toContain('transform="translate(223,184)"');
    expect(svg).not.toContain("M7.5 20 L31.5 20 L40.5 15 L16.5 15 Z");
  });
});

describe("brickLogoImg", () => {
  it("builds a raster <img> with correct size and alt", () => {
    const img = brickLogoImg(34, "https://realflip.app");
    expect(img).toContain('<img src="https://realflip.app/brickon.png"');
    expect(img).toContain('width="34"');
    expect(img).toContain('height="31"');
    expect(img).toContain('alt="Brickon"');
    expect(img).toContain('data-logo="brickon"');
    expect(img).not.toContain("<svg");
  });

  it("normalizes a trailing slash in baseUrl", () => {
    const img = brickLogoImg(34, "https://realflip.app/");
    expect(img).toContain('src="https://realflip.app/brickon.png"');
  });
});