import { getRealingoClient } from "./graphql-client";
import type { RealingoScanPricePoint, RealingoScanResult, RealingoScanStatus } from "./types";

const SCAN_FIELDS = `
  id
  address
  status
  message
  errorMessage
  completedAt
  createdAt
  updatedAt
  result { avgPrice minPrice maxPrice avgPriceM2 rangePrice searchDistance recordsCount }
  priceIndex { date avgPrice minPrice maxPrice avgPriceM2 }
`;

const CREATE_FROM_OFFER = `mutation ValuationDialogCreateValuationScanFromOffer($offerId: ID!) {
  createValuationScanFromOffer(offerId: $offerId) {
    ${SCAN_FIELDS}
  }
}`;

const GET_SCAN = `query ValuationDialogGetValuationScan($id: ID!) {
  valuationScan(id: $id) {
    ${SCAN_FIELDS}
  }
}`;

const GET_COMPARABLES = `query ValuationDialogGetValuationScanComparableOffers($scanId: ID!) {
  valuationScanComparableOffers(scanId: $scanId) {
    id
    url
    category
    price { total squareMeter currency }
    area { main }
    location { latitude longitude }
    photos { main }
  }
}`;

export interface RealingoComparable {
  id: string;
  url: string;
  price: number | null;
  pricePerSqm: number | null;
  area: number | null;
  latitude: number | null;
  longitude: number | null;
}

function toScanStatus(raw: {
  id: string;
  address?: string | null;
  status?: string | null;
  message?: string | null;
  errorMessage?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  result?: RealingoScanResult | null;
  priceIndex?: (RealingoScanPricePoint & { date?: string | null })[] | null;
}): RealingoScanStatus {
  const p = (d: string | null | undefined) => (d ? Date.parse(d) : null);
  return {
    id: raw.id,
    address: raw.address ?? null,
    status: raw.status ?? null,
    message: raw.message ?? null,
    errorMessage: raw.errorMessage ?? null,
    result: raw.result ?? null,
    priceIndex: (raw.priceIndex ?? []).map((pt) => ({
      date: pt.date ?? null,
      avgPrice: pt.avgPrice ?? null,
      minPrice: pt.minPrice ?? null,
      maxPrice: pt.maxPrice ?? null,
      avgPriceM2: pt.avgPriceM2 ?? null,
    })),
    completedAt: p(raw.completedAt),
    createdAt: p(raw.createdAt),
    updatedAt: p(raw.updatedAt),
  };
}

/** Vytvoří RealScan odhad z existující nabídky (offerId = Realingo id). */
export async function createScanFromOffer(
  offerId: string
): Promise<RealingoScanStatus | null> {
  const client = getRealingoClient();
  const res = await client.gql<{
    createValuationScanFromOffer: RealingoScanStatus | null;
  }>(CREATE_FROM_OFFER, "ValuationDialogCreateValuationScanFromOffer", { offerId });
  if (res.errors?.length) {
    throw new Error(res.errors.map((e) => e.message).join("; "));
  }
  return res.data?.createValuationScanFromOffer ? toScanStatus(res.data.createValuationScanFromOffer as never) : null;
}

/** Získá aktuální stav vybraného scanu. */
export async function getScan(id: string): Promise<RealingoScanStatus | null> {
  const client = getRealingoClient();
  const res = await client.gql<{ valuationScan: RealingoScanStatus }>(
    GET_SCAN,
    "ValuationDialogGetValuationScan",
    { id }
  );
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join("; "));
  return res.data?.valuationScan ? toScanStatus(res.data.valuationScan as never) : null;
}

/** Srovnávané nabídky v okolí scanu. */
export async function getScanComparables(
  scanId: string
): Promise<RealingoComparable[]> {
  const client = getRealingoClient();
  const res = await client.gql<{
    valuationScanComparableOffers: {
      id: string;
      url: string;
      price?: { total?: number | null; squareMeter?: number | null };
      area?: { main?: number | null };
      location?: { latitude?: number | null; longitude?: number | null };
      photos?: { main?: string | null };
    }[];
  }>(GET_COMPARABLES, "ValuationDialogGetValuationScanComparableOffers", { scanId });
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join("; "));
  const raw = res.data?.valuationScanComparableOffers ?? [];
  return raw.map((c) => ({
    id: c.id,
    url: c.url,
    price: c.price?.total ?? null,
    pricePerSqm: c.price?.squareMeter ?? null,
    area: c.area?.main ?? null,
    latitude: c.location?.latitude ?? null,
    longitude: c.location?.longitude ?? null,
  }));
}

/** Čeká na dokončení scanu (polling do maxErrors). */
export async function waitForScan(
  id: string,
  { timeoutMs = 90_000, intervalMs = 4000 } = {}
): Promise<RealingoScanStatus> {
  const start = Date.now();
  let scan: RealingoScanStatus | null = await getScan(id);
  while (
    scan &&
    scan.status !== "COMPLETED" &&
    scan.status !== "DONE" &&
    scan.status !== "FAILED" &&
    scan.status !== "ERROR" &&
    Date.now() - start < timeoutMs
  ) {
    await new Promise((r) => setTimeout(r, intervalMs));
    scan = await getScan(id);
  }
  if (!scan) throw new Error("RealScan: nedostupný");
  return scan;
}
