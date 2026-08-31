import type {
  AresScore,
  CatastrOwnership,
  VrCompanyDetail,
} from "./types";

const COMPANY_LEGAL_FORMS = new Set(["112", "121", "129", "141"]);
const SPOLEK_RE = /\bspolek\b|\bzapsaný spolek\b|\bz\.s\./i;

/**
 * Score a liquidation/execution company as a flip candidate.
 *
 * Reasoning:
 *  - The whole point is converting a company's liquidation/execution into a
 *    below-market acquisition of its property.
 *  - Owning a "jednotka" (flat unit) / building is the strongest signal that a
 *    real residential asset is on the table.
 *  - Obchodní korporace (s.r.o. / a.s.) are better counterparties than spolky
 *    (associations), which rarely hold valuable flats.
 *  - Execution adds distressed-sale urgency.
 */
export function scoreAresCompany(
  detail: VrCompanyDetail,
  ownership: CatastrOwnership | null,
  now: number = Date.now()
): AresScore {
  let score = 25;
  const reasons: string[] = ["Firma v likvidaci/exekuci"];

  const reasoning = (detail.liquidationReasoning ?? "").toLowerCase();
  const isCompanyForm =
    (detail.legalForm && COMPANY_LEGAL_FORMS.has(detail.legalForm)) ||
    !SPOLEK_RE.test(detail.liquidationReasoning ?? "");

  if (detail.hasExecution) {
    score += 20;
    reasons.push("Evidence exekuce — nucený prodej");
  }

  if (isCompanyForm) {
    score += 10;
    reasons.push("Obchodní korporace — reálný flip protějšek");
  } else if (SPOLEK_RE.test(reasoning)) {
    score -= 8;
    reasons.push("Spolek — nízká pravděpodobnost bytového majetku");
  }

  if (detail.sidlo) {
    const lower = detail.sidlo.toLowerCase();
    if (lower.includes("praha") || lower.includes("brno")) {
      score += 5;
      reasons.push("Sídlo Praha/Brno — vysoká poptávka");
    }
  }

  if (ownership) {
    if (ownership.verified && ownership.properties.length > 0) {
      score += 15;
      reasons.push(`Katastr: ${ownership.properties.length} nemovitostí potvrzeno`);
      const hasUnit = ownership.properties.some(
        (p) => p.typParcely === "STAVBA" || p.typBudovy
      );
      if (hasUnit) {
        score += 15;
        reasons.push("Stavba/jednotka v majetku firmy");
      }
    } else if (!ownership.verified && ownership.reason) {
      // Not verified (no WSDP credentials or lookup failed) — neutral.
      reasons.push("Vlastnictví neověřeno (je potřeba WSDP účet)");
    }
  }

  if (detail.liquidationDate) {
    const days = Math.floor((now - detail.liquidationDate) / (1000 * 60 * 60 * 24));
    if (days < 120) {
      score += 5;
      reasons.push("Čerstvá likvidace (< 4 měsíce)");
    } else if (days > 730) {
      score -= 10;
      reasons.push("Likvidace starší 2 let");
    }
  }

  if (detail.status === "ZANIKLY") {
    score -= 20;
    reasons.push("Subjekt zanikl — majetek pravděpodobně převeden");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
