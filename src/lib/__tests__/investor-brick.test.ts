import { describe, it, expect } from "vitest";
import { brickInnerMarkup, brickLogoSvg } from "../investor-brick";

describe("brickLogoSvg", () => {
  it("builds an SVG with logo markers and correct size", () => {
    const svg = brickLogoSvg(32, "light");
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="32"');
    expect(svg).toContain('viewBox="0 0 48 48"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Brickon"');
    expect(svg).toContain('data-logo="brickon"');
  });

  it("uses white body in light tone", () => {
    expect(brickLogoSvg(32, "light")).toContain('fill="#ffffff"');
  });

  it("uses emerald body in brand tone", () => {
    expect(brickLogoSvg(32, "brand")).toContain('fill="#10b981"');
  });

  it("includes the B built from five isometric bricks", () => {
    const markup = brickInnerMarkup("light");
    const rects = markup.match(/<rect/g) ?? [];
    const paths = markup.match(/<path/g) ?? [];
    expect(rects.length).toBe(5);
    expect(paths.length).toBe(10);
    expect(markup).toContain("M4 10 L20 10 L23 7 L7 7 Z");
    expect(markup).toContain("M26 10 L42 10 L45 7 L29 7 Z");
  });
});
