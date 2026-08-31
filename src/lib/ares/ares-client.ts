import type {
  AresNotification,
  AresNotificationBatch,
  VrCompanyDetail,
} from "./types";

const API_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`ARES ${url} -> HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** List notification batches (change-feed) for the VR data source. */
export async function listNotificationBatches(): Promise<AresNotificationBatch[]> {
  const body = JSON.stringify({ datovyZdroj: "vr" });
  const data = await request<{ notifikacniDavky: AresNotificationBatch[] }>(
    `${API_BASE}/ekonomicke-subjekty-notifikace/vyhledat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }
  );
  // Batches come back in ascending order; newest first is the most useful.
  return (data.notifikacniDavky ?? []).sort(
    (a, b) => b.cisloDavky - a.cisloDavky
  );
}

/** Get the full change list of a single notification batch. */
export async function getNotificationBatch(
  cisloDavky: number
): Promise<AresNotification[]> {
  const data = await request<{
    seznamNotifikaci?: AresNotification[];
  }>(
    `${API_BASE}/ekonomicke-subjekty-notifikace/datovy-zdroj/vr/cislo-davky/${cisloDavky}`
  );
  return data.seznamNotifikaci ?? [];
}

const LIQUIDATION_RE = /\blikvidac|likvidátor|likvidátora|zrušen/i;
const EXECUTION_RE = /\bexeku/i;

function pickLatest<T extends { datumZapisu?: string }>(items: T[] | undefined): T | null {
  if (!items || items.length === 0) return null;
  return items.reduce((a, b) => {
    const ad = a.datumZapisu ?? "";
    const bd = b.datumZapisu ?? "";
    return bd > ad ? b : a;
  });
}

function toEpochMs(date?: string): number | null {
  if (!date) return null;
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? null : ms;
}

export function extractLiquidationDate(
  ostatniSkutecnosti: { datumZapisu?: string; hodnota?: string }[] | undefined
): number | null {
  if (!ostatniSkutecnosti) return null;
  const liquidation = ostatniSkutecnosti.filter((o) =>
    LIQUIDATION_RE.test(o.hodnota ?? "")
  );
  const latest = pickLatest(liquidation);
  return latest ? toEpochMs(latest.datumZapisu) : null;
}

interface VrName {
  hodnota?: string;
}

interface VrRecord {
  obchodniJmeno?: VrName[];
  pravniForma?: VrName[];
  adresy?: { typAdresy?: string; adresa?: { textovaAdresa?: string } }[];
  spisovaZnacka?: { soud?: string; oddil?: string; vlozka?: number }[];
  ostatniSkutecnosti?: { datumZapisu?: string; hodnota?: string }[];
  exekuce?: unknown[];
  datumAktualizace?: string;
  stavSubjektu?: string;
}

/** Fetch and normalize the VR detail for one IČO. */
export async function getCompanyDetail(ico: string): Promise<VrCompanyDetail> {
  const data = await request<{ icoId: string; zaznamy?: unknown[] }>(
    `${API_BASE}/ekonomicke-subjekty-vr/${ico}`
  );

  const rec = (data.zaznamy ?? [])[0] as VrRecord | undefined;

  const ostatni = rec?.ostatniSkutecnosti ?? [];
  const ostatniText = ostatni
    .map((o) => o.hodnota ?? "")
    .filter(Boolean)
    .join(" \n ");
  const isLiquidating = LIQUIDATION_RE.test(ostatniText) || LIQUIDATION_RE.test(rec?.obchodniJmeno?.slice(-1)[0]?.hodnota ?? "");
  const hasExecution = EXECUTION_RE.test(ostatniText) || (rec?.exekuce?.length ?? 0) > 0;

  // Reason excerpt preferentially from the *latest* liquidation-related record.
  const liquidationRecords = ostatni.filter((o) => LIQUIDATION_RE.test(o.hodnota ?? ""));
  const latestLiq = pickLatest(liquidationRecords);
  const reasoning = latestLiq?.hodnota ?? null;

  const spis = rec?.spisovaZnacka?.[0];
  const sidloRec = rec?.adresy?.find((a) => a.typAdresy === "SIDLO") ?? rec?.adresy?.[0];

  return {
    ico,
    name: rec?.obchodniJmeno?.slice(-1)[0]?.hodnota ?? rec?.obchodniJmeno?.[0]?.hodnota ?? null,
    legalForm: rec?.pravniForma?.slice(-1)[0]?.hodnota ?? rec?.pravniForma?.[0]?.hodnota ?? null,
    sidlo: sidloRec?.adresa?.textovaAdresa ?? null,
    court: (spis?.soud ?? null) as string | null,
    spisovaZnacka:
      spis?.oddil && spis.vlozka != null
        ? `${spis.soud ?? ""} ${spis.oddil} ${spis.vlozka}`.trim()
        : null,
    status: rec?.stavSubjektu ?? "AKTIVNI",
    hasExecution,
    isLiquidating,
    liquidationReasoning: reasoning,
    liquidationDate: isLiquidating
      ? extractLiquidationDate(ostatni)
      : null,
    lastUpdatedAres: toEpochMs(rec?.datumAktualizace),
    rawJson: data as Record<string, unknown>,
  };
}
