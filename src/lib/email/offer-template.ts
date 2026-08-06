import type { InvestorPortalItem } from "@/lib/investor-portal-view";
import { formatCompactPrice } from "@/lib/utils";

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
      <td style="padding:8px 0;font-size:13px;color:#8b8fa3;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;${
        accent ? "color:#34d399;" : "color:#e4e4ef;"
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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0b0b12;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b12;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#12121c;border:1px solid #26263a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);">
              <p style="margin:0;font-size:18px;font-weight:bold;color:#ffffff;">RealFlip · Nová nabídka</p>
              <p style="margin:6px 0 0;font-size:12px;color:#d6c9ff;">Investorský portál — nemovitost ve fázi vyjednávání</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;">${escapeHtml(location)}</p>
              <p style="margin:8px 0 0;font-size:13px;color:#8b8fa3;">${escapeHtml(details)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #26263a;">
                ${row("Původní cena", price(offer.originalPrice))}
                ${row("Cena odkupu", price(offer.offerPrice))}
                ${row("Úspora", savings, offer.savingsPct !== null && offer.savingsPct > 0)}
                ${row("Očekávaný zisk", price(offer.netProfit), offer.netProfit !== null && offer.netProfit >= 0)}
                ${row("ROI", offer.roi !== null ? `${offer.roi.toFixed(1)} %` : "—")}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(baseUrl)}/investor" style="display:inline-block;padding:12px 28px;background-color:#7c3aed;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;border-radius:10px;">Zobrazit nabídky</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:11px;color:#5d6178;line-height:1.5;">Tento e-mail byl odeslán automaticky na základě publikace nabídky na portálu investorů. Nechcete-li nabídky dostávat, napište nám a nastavíme to za vás.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
