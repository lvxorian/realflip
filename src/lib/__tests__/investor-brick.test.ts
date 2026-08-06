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

  it("includes the extruded B geometry with three faces", () => {
    const markup = brickInnerMarkup("light");
    const paths = markup.match(/<path/g) ?? [];
    expect(paths.length).toBe(3);
    expect(markup).toContain("M11.5 8 H32.5");
    expect(markup).toContain('transform="translate(0 -2.5)"');
    expect(markup).toContain('transform="translate(2.5 0)"');
    expect(markup).toContain("V24");
  });
});
