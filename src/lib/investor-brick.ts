// Sdílená geometrie loga Brickon — vyražené písmeno B (2.5D emboss):
// přední plocha = B, světlý horní lem, tmavý boční lem. Jeden zdroj
// pravdy pro e-mail, web i favicon. viewBox 0 0 48 48.

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

// Blokové B se zaoblenými rohy (r=4), vycentrované v 48×48.
// Silueta: levá osa + horní boulíček + zářez + dolní boulíček.
const B_PATH =
  "M11.5 8 H32.5 A4 4 0 0 1 36.5 12 V16 A4 4 0 0 1 32.5 20 H21.5 V24 H32.5 A4 4 0 0 1 36.5 28 V36 A4 4 0 0 1 32.5 40 H11.5 Z";

export function brickInnerMarkup(tone: BrickTone = "light"): string {
  const t = TONES[tone];
  return `
  <path d="${B_PATH}" transform="translate(0 -2.5)" fill="${t.top}" opacity="${t.topOpacity}"/>
  <path d="${B_PATH}" transform="translate(2.5 0)" fill="${t.right}" opacity="${t.rightOpacity}"/>
  <path d="${B_PATH}" fill="${t.front}" opacity="${t.frontOpacity}"/>`;
}

export function brickLogoSvg(size: number, tone: BrickTone = "light"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" role="img" aria-label="Brickon" data-logo="brickon">${brickInnerMarkup(tone)}</svg>`;
}
