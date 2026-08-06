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
    expect(markup).toContain("M10 21 L30 21 L39 16 L19 16 Z");
    expect(markup).toContain("M30 21 L39 16 L39 27 L30 32 Z");
    expect(markup).toContain('width="20" height="11"');
  });
});
