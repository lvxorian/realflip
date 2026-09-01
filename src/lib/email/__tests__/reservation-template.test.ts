import { describe, it, expect } from "vitest";
import { buildReservationEmailHtml } from "../reservation-template";

const base = {
  investorName: "Jan Novák",
  propertyTitle: "Byt 3+kk Vinohrady",
  propertyAddress: "Slezská 12, Praha 2",
  strategy: "fifty-fifty" as const,
  baseUrl: "https://brickon.example",
};

describe("buildReservationEmailHtml", () => {
  it("obsahuje plnou adresu (po rezervaci se ne-maskuje)", () => {
    const html = buildReservationEmailHtml(base);
    expect(html).toContain("Slezská 12, Praha 2");
    expect(html).not.toContain("masked");
  });

  it("bez kontaktu se chová jako dřív — žádný kontakt blok", () => {
    const html = buildReservationEmailHtml(base);
    expect(html).not.toContain("Kontakt na prodávajícího");
    expect(html).toContain("Vstoupit do portálu");
  });

  it("s kontaktem vykreslí jméno, tel: i mailto: odkazy", () => {
    const html = buildReservationEmailHtml({
      ...base,
      contact: { name: "Petr Dlužník", phone: "+420 608 033 397", email: "petr@example.com" },
    });
    expect(html).toContain("Kontakt na prodávajícího");
    expect(html).toContain("Petr Dlužník");
    expect(html).toContain('href="tel:+420608033397"');
    expect(html).toContain('href="mailto:petr@example.com"');
    expect(html).toContain("nebo můžete ozvat rovnou podle kontaktu výše");
  });

  it("HTML-escapuje kontakt i adresu (injection z DB dat)", () => {
    const html = buildReservationEmailHtml({
      propertyTitle: null,
      propertyAddress: "<script>alert(1)</script>",
      investorName: "<b>X</b>",
      contact: { name: "<img src=x>", phone: null, email: null },
      strategy: null,
      baseUrl: "https://x",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("kontakt jen s telefonem vynechá prázdné řádky", () => {
    const html = buildReservationEmailHtml({
      ...base,
      contact: { name: null, phone: "+420 700 100 200", email: null },
    });
    expect(html).toContain("tel:+420700100200");
    expect(html).not.toContain("mailto:");
  });
});
