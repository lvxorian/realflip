import { escapeHtml } from "@/lib/email/offer-template";
import { INVESTOR_BRAND } from "@/lib/investor-brand";
import { brickLogoImg } from "@/lib/investor-brick";

const T = {
  bg: "#0c0c0f",
  card: "#18181b",
  border: "#27272a",
  foreground: "#f5f5f0",
  muted: "#a1a1aa",
  mutedForeground: "#71717a",
  accent: "#10b981",
  accentHover: "#059669",
  accentSoft: "#d1fae5",
  danger: "#ef4444",
  dangerSoft: "#fecaca",
};

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap" rel="stylesheet">';

/** Email pro investora — potvrzení zrušení rezervace */
export function buildCancelReservationInvestorHtml(
  opts: {
    investorName: string;
    propertyTitle: string | null;
    propertyAddress: string | null;
    baseUrl: string;
  },
): string {
  const location = [opts.propertyTitle, opts.propertyAddress].filter(Boolean).join(" · ") || "Nemovitost";

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${FONT_LINK}</head>
<body style="margin:0;padding:0;background-color:${T.bg};font-family:'Geist',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${T.bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${T.card};border:1px solid ${T.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,${T.danger} 0%,#dc2626 100%);">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">${brickLogoImg(34, opts.baseUrl)}</td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;">${escapeHtml(INVESTOR_BRAND).toUpperCase()} · Rezervace zrušena</p>
                    <p style="margin:6px 0 0;font-size:12px;color:${T.dangerSoft};">Vaše rezervace byla zrušena.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0;font-size:14px;color:${T.muted};line-height:1.6;">
                Vážený/á <strong style="color:${T.foreground};">${escapeHtml(opts.investorName)}</strong>,
              </p>
              <p style="margin:10px 0 0;font-size:14px;color:${T.muted};line-height:1.6;">
                zrušili jste rezervaci nemovitosti níže. Nabídka se vrací zpět do portálu a je opět dostupná pro ostatní investory.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid ${T.border};">
                <tr>
                  <td style="padding:12px 0 0 0;font-size:20px;font-weight:600;color:${T.foreground};">${escapeHtml(location)}</td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;color:${T.muted};line-height:1.6;">
                Pokud jste to nechtěli, můžete si nemovitost zarezervovat znovu, pokud je stále dostupná.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(opts.baseUrl)}/investor" style="display:inline-block;padding:12px 28px;background-color:${T.accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">Vstoupit do portálu</a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:11px;color:${T.mutedForeground};line-height:1.5;">
                Pokud máte jakékoliv otázky, neváhejte nás kontaktovat na ${escapeHtml("cakmak@tuta.com")}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Email pro admina — notifikace o zrušení rezervace investorem */
export function buildCancelReservationAdminHtml(
  opts: {
    investorName: string;
    propertyTitle: string | null;
    propertyAddress: string | null;
    baseUrl: string;
  },
): string {
  const location = [opts.propertyTitle, opts.propertyAddress].filter(Boolean).join(" · ") || "Nemovitost";

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${FONT_LINK}</head>
<body style="margin:0;padding:0;background-color:${T.bg};font-family:'Geist',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${T.bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${T.card};border:1px solid ${T.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,${T.danger} 0%,#dc2626 100%);">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">${brickLogoImg(34, opts.baseUrl)}</td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;">${escapeHtml(INVESTOR_BRAND).toUpperCase()} · Zrušení rezervace</p>
                    <p style="margin:6px 0 0;font-size:12px;color:${T.dangerSoft};">Investor zrušil rezervaci</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0;font-size:14px;color:${T.muted};line-height:1.6;">
                Investor <strong style="color:${T.foreground};">${escapeHtml(opts.investorName)}</strong> zrušil rezervaci nemovitosti níže.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid ${T.border};">
                <tr>
                  <td style="padding:12px 0 0 0;font-size:20px;font-weight:600;color:${T.foreground};">${escapeHtml(location)}</td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;color:${T.muted};line-height:1.6;">
                Nabídka se vrací zpět do portálu a je opět dostupná pro ostatní investory.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="https://realflip.vercel.app/investors" style="display:inline-block;padding:12px 28px;background-color:${T.accent};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">Otevřít investory</a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:11px;color:${T.mutedForeground};line-height:1.5;">
                Tento e-mail je automatická notifikace pro administrátory ${escapeHtml(INVESTOR_BRAND)}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
