/**
 * Radar — AI Market Report (Gemini). Obsah se cacheuje v radar_reports
 * (PK region_key + range); tlačítko "Obnovit" generuje znovu on-demand.
 */

import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { radarReports } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { GEMINI_MODEL } from "@/lib/ai/gemini";
import { regionLabel } from "./radar-shared";
import {
  getCityHeatmap,
  getListingFlow,
  getMacroData,
  getPriceMapRegions,
  getSupplyVsPopulation,
} from "./radar-query";

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  return _client;
}

export interface RadarReport {
  content: string;
  generatedAt: number;
}

/** Přečte cacheovanou zprávu (null = není). */
export async function getCachedReport(regionKey: string, range: string): Promise<RadarReport | null> {
  try {
    const row = await db
      .select({ content: radarReports.content, generatedAt: radarReports.generatedAt })
      .from(radarReports)
      .where(and(eq(radarReports.regionKey, regionKey), eq(radarReports.range, range)))
      .then((r) => r[0]);
    if (!row) return null;
    return { content: row.content, generatedAt: Number(row.generatedAt) };
  } catch {
    return null;
  }
}

async function upsertReport(regionKey: string, range: string, content: string, generatedAt: number): Promise<void> {
  await db
    .insert(radarReports)
    .values({ regionKey, range, content, generatedAt })
    .onConflictDoUpdate({
      target: [radarReports.regionKey, radarReports.range],
      set: { content, generatedAt },
    });
}

const fmt = (v: number, d = 0) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: d }).format(v);

/** Sestaví stručný datový kontext pro AI (čísla místo surových řad). */
async function buildReportContext(regionKey: string, range: string): Promise<string> {
  const [macro, priceMap, flow, supply, cities] = await Promise.all([
    getMacroData(range),
    getPriceMapRegions(),
    getListingFlow(12),
    getSupplyVsPopulation(),
    getCityHeatmap(8),
  ]);

  const kpi = (key: string) => macro.kpis.find((k) => k.key === key);

  const lines: string[] = [];
  lines.push(`Region: ${regionLabel(regionKey)} (klíč ${regionKey}), rozsah ${range}.`);
  lines.push("");

  const repo = kpi("repo");
  const mortgage = kpi("mortgage");
  const cpi = kpi("cpi");
  const realWage = kpi("realWage");
  if (repo) lines.push(`Repo sazba ČNB: ${repo.value} % (${repo.period}).`);
  if (mortgage) lines.push(`Průměrná hypoteční sazba nových hypoték (ČBA): ${mortgage.value} % (${mortgage.period}).`);
  if (cpi) lines.push(`Meziroční inflace (CPI): ${cpi.value} % (${cpi.period}).`);
  if (realWage) lines.push(`Meziroční růst reálných mezd: ${realWage.value} % (${realWage.period}).`);
  const lastGap = macro.gaps[macro.gaps.length - 1];
  if (lastGap) lines.push(`Rozdíl hypoteční sazba − repo (yield gap): ${lastGap.gap} p.b. (${lastGap.period}).`);
  if (macro.cpiReal.length >= 2) {
    const q = macro.cpiReal[macro.cpiReal.length - 1];
    lines.push(`Poslední kvartál: CPI ${q.cpi} %, reálné mzdy ${q.realWage} % (${q.period}).`);
  }
  lines.push("");

  if (flow.length >= 3) {
    const totalNew = flow.reduce((s, p) => s + p.nove, 0);
    const totalRemoved = flow.reduce((s, p) => s + p.stazene, 0);
    lines.push(`Vlastní sledování trhu (12 měsíců): ${fmt(totalNew)} nových inzerátů, ${fmt(totalRemoved)} stažených.`);
  }
  lines.push("");

  if (regionKey === "cr") {
    const avg = priceMap.reduce((s, r) => s + r.pricePerSqm, 0) / Math.max(priceMap.length, 1);
    lines.push(`Průměrná cena bytu z realizovaných prodejů (cenová mapa, 14 krajů): ~${fmt(avg)} Kč/m².`);
    lines.push(`Nejdražší kraj: ${priceMap[0]?.name ?? "—"} (${fmt(priceMap[0]?.pricePerSqm ?? 0)} Kč/m²), nejlevnější: ${priceMap[priceMap.length - 1]?.name ?? "—"} (${fmt(priceMap[priceMap.length - 1]?.pricePerSqm ?? 0)} Kč/m²).`);
  } else {
    const row = priceMap.find((r) => r.regionKey === regionKey);
    if (row) lines.push(`Realizované ceny v kraji (cenová mapa): ${fmt(row.pricePerSqm)} Kč/m² (${fmt(row.transactions)} transakcí).`);
  }
  lines.push("");

  const sup = supply.find((s) => s.regionKey === regionKey) ?? supply[0];
  if (sup) {
    lines.push(`Zahájené byty za rok ${sup.year}: ${fmt(sup.started)}; meziroční přírůstek obyvatel: ${sup.popGrowth} %.`);
    const per100k = sup.popGrowth !== 0 ? Math.round((sup.started / 1) / Math.max(Math.abs(sup.popGrowth), 0.01) / 1000) : 0;
    lines.push(`Orientační poměr: ${fmt(per100k, 1)} zahájených bytů na 0,01 p.b. přírůstku obyvatel.`);
  }
  lines.push("");

  if (cities.length > 0) {
    lines.push("Města podle počtu sledovaných inzerátů:");
    for (const c of cities.slice(0, 5)) {
      const p2r = c.priceToRent != null ? `${c.priceToRent} let` : "n/a";
      lines.push(`- ${c.name}: ${fmt(c.pricePerSqm)} Kč/m², nájem ${c.rentPerSqm != null ? fmt(c.rentPerSqm) + " Kč/m²" : "n/a"}, price-to-rent ${p2r}${c.share65plus != null ? `, 65+ ${c.share65plus} %` : ""}.`);
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = [
  "Jsi zkušený realitní analytik českého trhu s nemovitostmi.",
  "Na základě poskytnutých dat napiš stručnou tržní zprávu v češtině (150–250 slov).",
  "Používej markdown: nadpisy bez # (tučný text), krátké odstavce.",
  "Zmiň pouze to, co data potvrzují; vyhni se spekulacím bez podkladu.",
  "Závěr: 1–2 věty, jak atraktivní je trh pro investory do bytů.",
].join(" ");

/** Vygeneruje zprávu přes Gemini (bez cache). Selhání vrací null. */
export async function generateReport(regionKey: string, range: string): Promise<RadarReport | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const context = await buildReportContext(regionKey, range);
  // Primární model + záložní při 503 (vytížený model / dočasná nedostupnost)
  const models = [GEMINI_MODEL, "gemini-2.5-flash", "gemini-3.5-flash-lite"].filter((m, i, a) => a.indexOf(m) === i);
  let lastErr: unknown = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await getClient().models.generateContent({
          model,
          contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "user", parts: [{ text: `Data:\n${context}` }] },
          ],
          config: { temperature: 0.3 },
        });
        const text = response.text;
        if (!text?.trim()) return null;
        return { content: text.trim(), generatedAt: Date.now() };
      } catch (e) {
        lastErr = e;
        // 503 (vytížený model) je dočasný — krátká pauza a ještě jeden pokus
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  console.error("Radar report error:", lastErr);
  return null;
}

/**
 * Vrátí cacheovanou zprávu nebo vygeneruje a uloží novou.
 * `force` = regenerace bez ohledu na cache (tlačítko Obnovit).
 */
export async function getOrGenerateReport(
  regionKey: string,
  range: string,
  force = false
): Promise<RadarReport | null> {
  if (!force) {
    const cached = await getCachedReport(regionKey, range);
    if (cached) return cached;
  }
  const generated = await generateReport(regionKey, range);
  if (!generated) return null;
  try {
    await upsertReport(regionKey, range, generated.content, generated.generatedAt);
  } catch (e) {
    console.error("Radar report upsert failed:", e);
  }
  return generated;
}
