import "./_env";
import { sendEmail } from "../src/lib/email/send-email";

// Ověří odeslání e-mailu přes Resend: npx tsx scripts/test-email.ts adresa@example.cz
async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Použití: npx tsx scripts/test-email.ts adresa@example.cz");
    process.exit(1);
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY není nastaven v .env.local — přidejte ho a zkuste znovu.");
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: "RealFlip · Testovací e-mail",
    html: `<p style="font-family:Arial,sans-serif;">Toto je testovací e-mail z <strong>RealFlip</strong>. Pokud ho vidíte, odesílání nabídek investorům funguje.</p>`,
  });

  if (result.sent) {
    console.log(`E-mail odeslán (id ${result.id}) — zkontrolujte doručenou poštu ${to}.`);
  } else {
    console.error("Odeslání se nezdařilo:", result.reason);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});