/**
 * Radar — sdílené helpery: region klíče, měsíční periody, CSV parsing,
 * extrakce ČBA blade_graphData z HTML.
 */

export type RegionType = "cr" | "kraj" | "city";

/** RUIAN kód kraje (ČSÚ) → náš region klíč (shodný s crime.ts CITY_TO_REGION). */
export const KRAJ_CODE_TO_KEY: Record<string, string> = {
  CZ010: "praha",
  CZ020: "stredocesky",
  CZ031: "jihocesky",
  CZ032: "plzensky",
  CZ041: "karlovarsky",
  CZ042: "ustecky",
  CZ051: "liberecky",
  CZ052: "kralovehradecky",
  CZ053: "pardubicky",
  CZ063: "vysocina",
  CZ064: "jihomoravsky",
  CZ071: "olomoucky",
  CZ072: "zlinsky",
  CZ080: "moravskoslezsky",
};

export const KRAJ_KEYS = Object.values(KRAJ_CODE_TO_KEY);

/** Náš region klíč → RUIAN kód kraje (opačný směr). */
export const KRAJ_KEY_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(KRAJ_CODE_TO_KEY).map(([code, key]) => [key, code])
);

/** Zobrazovací názvy regionů (UI + AI report). */
export const REGION_LABELS: Record<string, string> = {
  cr: "Česká republika",
  praha: "Hlavní město Praha",
  stredocesky: "Středočeský kraj",
  jihocesky: "Jihočeský kraj",
  plzensky: "Plzeňský kraj",
  karlovarsky: "Karlovarský kraj",
  ustecky: "Ústecký kraj",
  liberecky: "Liberecký kraj",
  kralovehradecky: "Královéhradecký kraj",
  pardubicky: "Pardubický kraj",
  vysocina: "Kraj Vysočina",
  jihomoravsky: "Jihomoravský kraj",
  olomoucky: "Olomoucký kraj",
  zlinsky: "Zlínský kraj",
  moravskoslezsky: "Moravskoslezský kraj",
};

/** Název regionu pro zobrazení. */
export function regionLabel(regionKey: string): string {
  return REGION_LABELS[regionKey] ?? regionKey;
}

/** region klíč → typ regionu. */
export function regionTypeOf(regionKey: string): RegionType {
  if (regionKey === "cr") return "cr";
  if (KRAJ_KEYS.includes(regionKey)) return "kraj";
  return "city";
}

/** "2026-08" → Date (1. den měsíce). */
export function periodToDate(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** Date → "YYYY-MM". */
export function dateToPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Poslední měsíc čtvrtletí: "2026-Q3" → "2026-09". */
export function quarterToPeriod(q: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  if (!m) throw new Error(`Neplatné čtvrtletí: ${q}`);
  const month = Number(m[2]) * 3;
  return `${m[1]}-${String(month).padStart(2, "0")}`;
}

/** Rozsah pohledu → počet měsíců. */
export function rangeMonths(range: string): number {
  switch (range) {
    case "1q":
      return 3;
    case "1y":
      return 12;
    case "3y":
      return 36;
    case "5y":
      return 60;
    default:
      return 12;
  }
}

/** "1/31/2020" (US formát z blade_graphData) → "2020-01". */
export function usDateToPeriod(x: string): string {
  const [m, , y] = x.split("/");
  return `${y}-${m.padStart(2, "0")}`;
}

/** Split CSV řádku s respektem k uvozovkám (stejný vzor jako sldb.ts). */
export function splitCsv(line: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

/** Odstraní uvozovky a trimuje. */
export function clean(v: string): string {
  return v.replace(/"/g, "").trim();
}

/** ČSÚ CSV dekódování — UTF-8 primárně, windows-1250 jako záchrana. */
export function decodeCzText(buf: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(buf));
  } catch {
    // není validní UTF-8 → windows-1250
  }
  try {
    return new TextDecoder("windows-1250").decode(new Uint8Array(buf));
  } catch {
    return buf.toString("utf8");
  }
}

/** Jeden bod ČBA série — klíč = pořadové ID, hodnoty x (US datum) a y (string i number). */
export interface BladePoint {
  x: string;
  y: number;
}

export type BladeSeries = Record<string, BladePoint>;

/**
 * Extrahuje `var blade_graphData = {...}` z HTML ČBA Monitoru a vrátí pole sérií.
 * Robustní k multi-line JSON i chybějícímu `;` na konci (balanced-brace scan,
 * stejný vzor jako price-map.ts extractQueryData).
 */
export function extractBladeGraphData(html: string): BladeSeries[] | null {
  const idx = html.indexOf("var blade_graphData");
  if (idx < 0) return null;
  const start = html.indexOf("{", idx + "var blade_graphData".length);
  if (start < 0) return null;
  let depth = 0;
  for (let j = start; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(html.slice(start, j + 1)) as { graph_data?: BladeSeries[] };
          return Array.isArray(parsed.graph_data) ? parsed.graph_data : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Blade série → seřazené body [period, value]. y může být string ("8.89"). */
export function bladeSeriesToPoints(series: BladeSeries): [string, number][] {
  return Object.entries(series)
    .map(([, p]) => [usDateToPeriod(p?.x ?? ""), Number(p?.y)] as [string, number])
    .filter(([period, value]) => /^\d{4}-\d{2}$/.test(period) && Number.isFinite(value))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** Česká desetinná čárka "11,30" → 11.3. */
export function czDecimal(v: string): number {
  return parseFloat(v.replace(",", "."));
}