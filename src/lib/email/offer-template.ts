import type { CooperationView, InvestorPortalItem } from "@/lib/investor-portal-view";
import { formatPrice } from "@/lib/utils";
import { COOPERATION_STRATEGIES } from "@/lib/cooperation-models";
import { INVESTOR_BRAND } from "@/lib/investor-brand";
import { brickLogoSvg } from "@/lib/investor-brick";

// Tokeny zrcadlící design system RealFlipu (globals.css) — jeden zdroj
// pravdy, aby e-mail vycházel ze stejného schématu jako aplikace.
const T = {
  bg: "#0c0c0f",
  card: "#18181b",
  border: "#27272a",
  foreground: "#f5f5f0",
  muted: "#a1a1aa",
  mutedForeground: "#71717a",
  accent: "#10b981",
  accentHover: "#059669",
  accentRow: "#34d399",
  accentSoft: "#d1fae5",
};

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap" rel="stylesheet">';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function price(v: number | null): string {
  // formatPrice používá NBSP jako oddělovač tisíců — v e-mailu je nahradíme
  // obyčejnou mezerou (stejný zápis „5 000 000" jako v aplikaci).
  return v !== null ? escapeHtml(formatPrice(v).replace(/\u00A0/g, " ")) : "—";
}

function renderFlipRows(offer: InvestorPortalItem): string {
  const deal = offer.deal?.type === "flip" ? offer.deal : null;
  const netProfit = deal?.netProfit ?? null;
  const roi = deal?.roi ?? null;
  return [
    row("Odhadovaný zisk", price(netProfit), netProfit !== null && netProfit >= 0),
    row("ROI (celkem)", roi !== null ? `${roi.toFixed(1)} %` : "—"),
  ].join("");
}

function renderRentalRows(offer: InvestorPortalItem): string {
  const deal = offer.deal?.type === "rental" ? offer.deal : null;
  const netYield = deal?.netYield ?? null;
  const cashFlowMonthly = deal?.cashFlowMonthly ?? null;
  return [
    row("Čistý výnos p.a.", netYield !== null ? `${netYield.toFixed(1)} %` : "—", netYield !== null && netYield >= 0),
    row("Cash-flow / měsíc", price(cashFlowMonthly), cashFlowMonthly !== null && cashFlowMonthly >= 0),
  ].join("");
}

function cooperationModelLabel(coop: CooperationView): string {
  const labels = coop.availableStrategies.map((s) => COOPERATION_STRATEGIES[s]);
  return labels.length === 2 ? `${labels[0]} nebo ${labels[1]}` : labels[0] ?? "—";
}

function renderCooperationRows(offer: InvestorPortalItem): string {
  const isFlip = offer.calcMode === "flip";
  if (isFlip && !offer.cooperation) return "";
  const modeLabel = isFlip ? "FLIP" : "NAJEM";
  const rows = [row("Způsob spolupráce", modeLabel)];
  if (isFlip && offer.cooperation) {
    rows.push(row("Model", cooperationModelLabel(offer.cooperation)));
    if (offer.cooperation.availableStrategies.includes("fifty-fifty")) {
      rows.push(row("Váš zisk při 50/50", price(offer.cooperation.investorProfitFiftyFifty)));
    }
    if (offer.cooperation.availableStrategies.includes("sourcing-fee")) {
      rows.push(row("Váš zisk při Sourcing fee", price(offer.cooperation.investorProfitSourcing)));
    }
  }
  return rows.join("");
}

function row(label: string, value: string, accent?: boolean): string {
  return `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:${T.muted};">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;white-space:nowrap;font-family:'Geist Mono',ui-monospace,monospace;${
        accent ? `color:${T.accentRow};` : `color:${T.foreground};`
      }">${value}</td>
    </tr>`;
}

export function buildOfferEmailHtml(offer: InvestorPortalItem, baseUrl: string): string {
  const location = [offer.city, offer.district].filter(Boolean).join(" · ") || "Neznámá lokalita";
  const details = [
    offer.condition ? `Stav: ${offer.condition}` : null,
    offer.rooms,
    offer.area ? `${offer.area} m²` : null,
    offer.buildingType && offer.buildingType !== "—" ? offer.buildingType : null,
    offer.floor !== null ? `${offer.floor}. podlaží` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const savings = offer.savingsPct !== null && offer.savingsPct > 0 ? `−${offer.savingsPct.toFixed(1)} %` : "—";

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${FONT_LINK}</head>
<body style="margin:0;padding:0;background-color:${T.bg};font-family:'Geist',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${T.bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${T.card};border:1px solid ${T.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,${T.accent} 0%,${T.accentHover} 100%);">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">${brickLogoSvg(34)}</td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;">${escapeHtml(INVESTOR_BRAND).toUpperCase()} · Nová nabídka</p>
                    <p style="margin:6px 0 0;font-size:12px;color:${T.accentSoft};">Soukromá nabídka — prověřená příležitost s vyjednanou cenou</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0;font-size:20px;font-weight:600;color:${T.foreground};">${escapeHtml(location)}</p>
              <p style="margin:8px 0 0;font-size:13px;color:${T.muted};">${escapeHtml(details)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid ${T.border};">
${row("Inzerovaná cena", price(offer.originalPrice))}
                ${row("Cena po vyjednání", price(offer.offerPrice))}
                ${row("Sleva oproti inzerci", savings, offer.savingsPct !== null && offer.savingsPct > 0)}
                ${
                  offer.calcMode === "rental"
                    ? renderRentalRows(offer)
                    : renderFlipRows(offer)
                }
                ${renderCooperationRows(offer)}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(baseUrl)}/investor" style="display:inline-block;padding:12px 28px;background-color:${T.accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">Vstoupit do portálu</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:11px;color:${T.mutedForeground};line-height:1.5;">Tento e-mail zasíláme investorům, kteří mají aktivované notifikace v portálu ${escapeHtml(INVESTOR_BRAND)}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}