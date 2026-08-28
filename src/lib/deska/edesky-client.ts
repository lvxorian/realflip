import { XMLParser } from "fast-xml-parser";

const API_BASE = "https://edesky.cz/api/v1";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name) => name === "document" || name === "attachment",
});

export interface EdeskyDocument {
  edesky_id: string;
  name: string;
  dashboard_name: string;
  dashboard_id: string;
  dashboard_category: string;
  dashboard_ovm_ico: string;
  dashboard_ruian_kod: string;
  edesky_url: string;
  orig_url: string;
  created_at: string;
  edesky_text_url?: string;
  attachments: {
    name: string;
    orig_url: string;
    url: string;
    mimetype: string;
    contains_text: string;
  }[];
}

export interface EdeskyDashboard {
  edesky_id: string;
  name: string;
  category: string;
  nuts3_name: string;
  nuts4_name: string;
  ovm_ico: string;
  ovm_zkratka: string;
  parent_id: string;
  ruian_kod: string;
  edesky_url: string;
}

function getApiKey(): string {
  const key = process.env.EDESKY_API_KEY;
  if (!key) throw new Error("EDESKY_API_KEY env variable is not set");
  return key;
}

export async function searchDocuments(params: {
  keywords: string;
  searchWith?: "es" | "sql";
  dashboardId?: string;
  createdFrom?: string;
  includeTexts?: boolean;
  order?: "date" | "score";
  page?: number;
}): Promise<{ documents: EdeskyDocument[]; totalCount: number; totalPages: number }> {
  const url = new URL(`${API_BASE}/documents`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("keywords", params.keywords);
  url.searchParams.set("search_with", params.searchWith ?? "es");
  if (params.dashboardId) url.searchParams.set("dashboard_id", params.dashboardId);
  if (params.createdFrom) url.searchParams.set("created_from", params.createdFrom);
  if (params.includeTexts) url.searchParams.set("include_texts", "1");
  url.searchParams.set("order", params.order ?? "date");
  url.searchParams.set("page", String(params.page ?? 1));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`edesky.cz API error: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: any = parser.parse(xml);

  const meta = parsed?.edesky_search_api?.meta;
  const docs = parsed?.edesky_search_api?.documents?.document ?? [];
  const totalCount = parseInt(meta?.documents_count?.total ?? "0", 10);
  const totalPages = parseInt(meta?.page?.total_pages ?? "0", 10);

  return { documents: Array.isArray(docs) ? docs : [docs], totalCount, totalPages };
}

export async function searchAllPages(params: {
  keywords: string;
  searchWith?: "es" | "sql";
  dashboardId?: string;
  createdFrom?: string;
  includeTexts?: boolean;
  order?: "date" | "score";
  maxPages?: number;
}): Promise<EdeskyDocument[]> {
  const maxPages = params.maxPages ?? 5;
  const allDocs: EdeskyDocument[] = [];
  let page = 1;

  while (page <= maxPages) {
    const result = await searchDocuments({ ...params, page });
    allDocs.push(...result.documents);
    if (page >= result.totalPages || result.documents.length === 0) break;
    page++;
  }

  return allDocs;
}

// Fetches the OCR plain-text body that the edesky API exposes via
// `edesky_text_url` (returned when including texts). Returns null if the
// document has no text endpoint or the fetch fails.
export async function fetchDocumentText(textUrl?: string | null): Promise<string | null> {
  if (!textUrl) return null;
  try {
    const res = await fetch(textUrl);
    if (!res.ok) return null;
    const text = await res.text();
    return text && text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function listDashboards(params?: {
  parentId?: string;
  includeSubordinated?: boolean;
}): Promise<EdeskyDashboard[]> {
  const url = new URL(`${API_BASE}/dashboards`);
  url.searchParams.set("api_key", getApiKey());
  if (params?.parentId) url.searchParams.set("id", params.parentId);
  if (params?.includeSubordinated) url.searchParams.set("include_subordinated", "1");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`edesky.cz dashboards API error: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: any = parser.parse(xml);

  const dashboards = parsed?.edesky_search_api?.dashboards?.dashboard ?? [];
  return Array.isArray(dashboards) ? dashboards : [dashboards];
}
