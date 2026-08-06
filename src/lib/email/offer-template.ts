import type { InvestorPortalItem } from "@/lib/investor-portal-view";
import { formatCompactPrice } from "@/lib/utils";
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
  return v !== null ? escapeHtml(formatCompactPrice(v)) : "—";
}

function row(label: string, value: string, accent?: boolean): string {
  return `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:${T.muted};">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;${
        accent ? `color:${T.accentRow};` : `color:${T.foreground};`
      }">${value}</td>
    </tr>`;
}

export function buildOfferEmailHtml(offer: InvestorPortalItem, baseUrl: string): string {
  const location = [offer.city, offer.district].filter(Boolean).join(" · ") || "Neznámá lokalita";
  const details = [offer.condition, offer.rooms, offer.area ? `${offer.area} m²` : null, offer.floor !== null ? `${offer.floor}. podlaží` : null]
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
                  <td style="vertical-align:middle;padding-right:12px;">${brickLogoSvg(34, "light")}</td>
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
                ${row("Tržní cena", price(offer.originalPrice))}
                ${row("Kupní cena", price(offer.offerPrice))}
                ${row("Sleva oproti trhu", savings, offer.savingsPct !== null && offer.savingsPct > 0)}
                ${row("Odhadovaný zisk", price(offer.netProfit), offer.netProfit !== null && offer.netProfit >= 0)}
                ${row("ROI", offer.roi !== null ? `${offer.roi.toFixed(1)} %` : "—")}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(baseUrl)}/investor" style="display:inline-block;padding:12px 28px;background-color:${T.accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">Vstoupit do portálu</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:11px;color:${T.mutedForeground};line-height:1.5;">Tento e-mail zasíláme investorům, kteří mají aktivované notifikace v portálu ${escapeHtml(INVESTOR_BRAND)}. Chcete-li odhlášení, odpovězte na tento e-mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}