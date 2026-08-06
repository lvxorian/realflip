// Sdílená geometrie loga Brickon — 2.5D cihla (přední plocha + světlejší
// horní plocha + 2 maltové spáry). Jeden zdroj pravdy pro e-mail i web.
// viewBox 0 0 48 48.

export type BrickTone = "light" | "brand";

interface BrickToneColors {
  front: string;
  top: string;
  topOpacity: string;
  right: string;
  rightOpacity: string;
  groove: string;
  grooveOpacity: string;
}

const TONES: Record<BrickTone, BrickToneColors> = {
  light: {
    front: "#ffffff",
    top: "#ffffff",
    topOpacity: "0.55",
    right: "#ffffff",
    rightOpacity: "0.3",
    groove: "#10b981",
    grooveOpacity: "0.4",
  },
  brand: {
    front: "#10b981",
    top: "#34d399",
    topOpacity: "1",
    right: "#047857",
    rightOpacity: "1",
    groove: "#064e3b",
    grooveOpacity: "0.5",
  },
};

export function brickInnerMarkup(tone: BrickTone = "light"): string {
  const t = TONES[tone];
  return `
  <path d="M10 16 L22 9 L38 9 L26 16 Z" fill="${t.top}" opacity="${t.topOpacity}"/>
  <path d="M26 16 L38 9 L38 38 L26 38 Z" fill="${t.right}" opacity="${t.rightOpacity}"/>
  <rect x="10" y="16" width="16" height="22" rx="3" fill="${t.front}"/>
  <line x1="13" y1="24" x2="23" y2="24" stroke="${t.groove}" stroke-opacity="${t.grooveOpacity}" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="13" y1="31" x2="23" y2="31" stroke="${t.groove}" stroke-opacity="${t.grooveOpacity}" stroke-width="1.5" stroke-linecap="round"/>`;
}

export function brickLogoSvg(size: number, tone: BrickTone = "light"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" role="img" aria-label="Brickon" data-logo="brickon">${brickInnerMarkup(tone)}</svg>`;
}
