// Sdílená geometrie loga Brickon — písmeno B postavené z 5 izometrických
// cihel (zdivo, prokládaná vazba): levá osa (3 cihly) + horní a dolní
// pravostranný boulíček (2 cihly), uprostřed zářez. Jeden zdroj pravdy
// pro e-mail, web i favicon. viewBox 0 0 48 48.

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

interface BrickPos {
  x: number;
  y: number;
}

// Cihly tvořící písmeno B: levá osa (3 řady) + pravostranné boulíčky
// (1. a 3. řada). Prostřední řada má jen osu → zářez uprostřed.
const BRICKS: BrickPos[] = [
  { x: 4, y: 10 },
  { x: 4, y: 21.5 },
  { x: 4, y: 33 },
  { x: 26, y: 10 },
  { x: 26, y: 33 },
];

function brickMarkup(b: BrickPos, t: BrickToneColors): string {
  const { x, y } = b;
  return `
  <path d="M${x} ${y} L${x + 16} ${y} L${x + 19} ${y - 3} L${x + 3} ${y - 3} Z" fill="${t.top}" opacity="${t.topOpacity}"/>
  <path d="M${x + 16} ${y} L${x + 19} ${y - 3} L${x + 19} ${y + 6} L${x + 16} ${y + 9} Z" fill="${t.right}" opacity="${t.rightOpacity}"/>
  <rect x="${x}" y="${y}" width="16" height="9" fill="${t.front}" opacity="${t.frontOpacity}"/>`;
}

export function brickInnerMarkup(tone: BrickTone = "light"): string {
  const t = TONES[tone];
  return BRICKS.map((b) => brickMarkup(b, t)).join("");
}

export function brickLogoSvg(size: number, tone: BrickTone = "light"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" role="img" aria-label="Brickon" data-logo="brickon">${brickInnerMarkup(tone)}</svg>`;
}
