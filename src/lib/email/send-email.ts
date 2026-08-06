export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  sent: boolean;
  id?: string;
  reason?: string;
}

const API_URL = "https://api.resend.com/emails";

function fromAddress(): string {
  const brand = process.env.NEXT_PUBLIC_INVESTOR_BRAND?.trim() || "Brickon";
  return process.env.EMAIL_FROM?.trim() || `${brand} <nabidky@realflip.cz>`;
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY není nastaven — e-mail přeskočen:", payload.subject);
    return { sent: false, reason: "missing_api_key" };
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[email] Resend chyba ${res.status}:`, text.slice(0, 500));
      return { sent: false, reason: `resend_error_${res.status}` };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: json.id };
  } catch (err) {
    console.error("[email] Nepodařilo se odeslat:", err);
    return { sent: false, reason: "network_error" };
  }
}
