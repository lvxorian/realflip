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

  it("includes the clean isometric brick geometry", () => {
    const markup = brickInnerMarkup("light");
    const rects = markup.match(/<rect/g) ?? [];
    const paths = markup.match(/<path/g) ?? [];
    expect(rects.length).toBe(1);
    expect(paths.length).toBe(2);
    expect(markup).toContain("M7.5 20 L31.5 20 L40.5 15 L16.5 15 Z");
    expect(markup).toContain("M31.5 20 L40.5 15 L40.5 28 L31.5 33 Z");
    expect(markup).toContain('width="24" height="13"');
  });
});
