import { XMLParser } from "fast-xml-parser";
import type { CatastrOwnership } from "./types";

const WSDP_ENDPOINT =
  process.env.CUZK_WSDP_ENDPOINT ??
  "https://katastr.cuzk.gov.cz/WSDP_EXT/getTemRequest";
const WSDP_USER = process.env.CUZK_WSDP_USER;
const WSDP_PASS = process.env.CUZK_WSDP_PASS;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    name === "LV" ||
    name === "Parcela" ||
    name === "Stavba" ||
    name === "PravniVztah" ||
    name === "TypPohybu",
});

/**
 * Reverse ownership look-up by IČO via the paid WSDP ("Přehled vlastnictví").
 *
 * Requires CUZK_WSDP_USER / CUZK_WSDP_PASS. When credentials are absent the
 * call degrades gracefully to an explicitly "unverified" result so the module
 * still works end-to-end without a paid account.
 */
export async function lookupOwnershipByIco(
  ico: string
): Promise<CatastrOwnership> {
  if (!WSDP_USER || !WSDP_PASS) {
    return {
      verified: false,
      reason: "Není nakonfigurován WSDP účet (CUZK_WSDP_USER/PASS).",
      totalLvs: 0,
      properties: [],
    };
  }

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <ctiOS xmlns="http://katastr.cuzk.gov.cz/WSDP_EXT/commonTypes">
      <Vstup>
        <Ico>${ico}</Ico>
      </Vstup>
    </ctiOS>
  </s:Body>
</s:Envelope>`;

  try {
    const res = await fetch(WSDP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "ctiOS",
        Authorization:
          "Basic " + Buffer.from(`${WSDP_USER}:${WSDP_PASS}`).toString("base64"),
      },
      body: soapBody,
    });

    if (!res.ok) {
      return {
        verified: false,
        reason: `WSDP HTTP ${res.status}`,
        totalLvs: 0,
        properties: [],
      };
    }

    const xml = await res.text();
    const doc = parser.parse(xml);
    return parseOwnershipXml(doc);
  } catch (e) {
    return {
      verified: false,
      reason: `WSDP chyba: ${e instanceof Error ? e.message : String(e)}`,
      totalLvs: 0,
      properties: [],
    };
  }
}

function findNested(node: unknown, key: string): unknown {
  if (node == null) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const v = findNested(item, key);
      if (v != null) return v;
    }
    return undefined;
  }
  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    if (key in rec) return rec[key];
    for (const v of Object.values(rec)) {
      const inner = findNested(v, key);
      if (inner != null) return inner;
    }
  }
  return undefined;
}

function parseOwnershipXml(doc: unknown): CatastrOwnership {
  const lvNodes = (findNested(doc, "LV") ?? []) as unknown[];
  const list = Array.isArray(lvNodes)
    ? (lvNodes as Record<string, unknown>[])
    : lvNodes
      ? [lvNodes as Record<string, unknown>]
      : [];

  const properties: CatastrOwnership["properties"] = [];

  for (const lv of list) {
    const lvId = toNumber(lv["LVId"] ?? lv["@_LVId"]);
    const katuzeKod = toNumber(
      lv["katUz"] ?? lv["KatUz"] ?? lv["KatuzeKod"] ?? lv["@_KatUz"]
    );

    const parcelas = (lv["Parcela"] ?? []) as unknown;
    const parcelasArr = (Array.isArray(parcelas)
      ? parcelas
      : parcelas
        ? [parcelas]
        : []) as Record<string, unknown>[];
    for (const p of parcelasArr) {
      properties.push({
        katuzeKod: katuzeKod ?? 0,
        lvId: lvId ?? 0,
        parcelniCislo: null,
        typParcely: "PARCELA",
        vymera: toNumber(p["vymera"] ?? p["Vymera"]),
        typBudovy: null,
      });
    }

    const stavby = (lv["Stavba"] ?? []) as unknown;
    const stavbyArr = (Array.isArray(stavby)
      ? stavby
      : stavby
        ? [stavby]
        : []) as Record<string, unknown>[];
    for (const s of stavbyArr) {
      const typ = (s["typPozemku"] ?? s["TypBudovy"] ?? s["typBudovy"] ?? "") as string;
      properties.push({
        katuzeKod: katuzeKod ?? 0,
        lvId: lvId ?? 0,
        parcelniCislo: (s["parcelniCislo"] ?? s["cisloPopisne"] ?? null) as string | null,
        typParcely: "STAVBA",
        vymera: toNumber(s["vymera"] ?? s["Vymera"]),
        typBudovy: typ || null,
      });
    }
  }

  const verified = properties.length > 0;
  return {
    verified,
    reason: verified
      ? `Nalezeno ${properties.length} nemovitostí na ${list.length} LV`
      : "Žádné nemovitosti nenalezeny",
    totalLvs: list.length,
    properties,
  };
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/\s/g, ""));
  return Number.isNaN(n) ? null : n;
}

/** Does the ownership result contain an apartment-style unit (flat/building)? */
export function hasApartment(ownership: CatastrOwnership): boolean {
  return ownership.properties.some((p) => {
    if (p.typBudovy) return true;
    if (p.typParcely === "STAVBA") return true;
    return false;
  });
}
