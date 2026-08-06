// Sdílená geometrie loga Brickon — čistá izometrická cihla (přední,
// horní a boční plocha, ostré hrany). Jeden zdroj pravdy pro e-mail
// i web. viewBox 0 0 48 48.

export type BrickTone = "light" | "brand";

interface BrickToneColors {
  front: string;
  frontOpacity: string;
  top: string;
  topOpacity: string;
  right: string;
  rightOpacity: string;
}

const TONES: Record<BrickTone, BrickToneColors> = {
  light: {
    front: "#ffffff",
    frontOpacity: "1",
    top: "#ffffff",
    topOpacity: "0.6",
    right: "#ffffff",
    rightOpacity: "0.28",
  },
  brand: {
    front: "#10b981",
    frontOpacity: "1",
    top: "#34d399",
    topOpacity: "1",
    right: "#047857",
    rightOpacity: "1",
  },
};

export function brickInnerMarkup(tone: BrickTone = "light"): string {
  const t = TONES[tone];
  return `
  <path d="M7.5 20 L31.5 20 L40.5 15 L16.5 15 Z" fill="${t.top}" opacity="${t.topOpacity}"/>
  <path d="M31.5 20 L40.5 15 L40.5 28 L31.5 33 Z" fill="${t.right}" opacity="${t.rightOpacity}"/>
  <rect x="7.5" y="20" width="24" height="13" fill="${t.front}" opacity="${t.frontOpacity}"/>`;
}

export function brickLogoSvg(size: number, tone: BrickTone = "light"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" role="img" aria-label="Brickon" data-logo="brickon">${brickInnerMarkup(tone)}</svg>`;
}
