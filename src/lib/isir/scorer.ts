import type { IsirEventData, ApartmentData, InsolvencyScore } from "./types";

export function scoreInsolvencyLead(
  event: IsirEventData,
  apartment: ApartmentData,
  publishedAt: number
): InsolvencyScore {
  let score = 30;
  const reasons: string[] = ["Byt nalezen v insolvenčním řízení"];

  const desc = `${event.popisUdalosti} ${event.poznamka}`.toLowerCase();

  const SECTION_B_BONUS = 20;
  if (event.oddil?.toUpperCase() === "B") {
    score += SECTION_B_BONUS;
    reasons.push("Sekce B — rozhodnutí o úpadku");
  }

  if (event.oddil?.toUpperCase() === "D") {
    score += 15;
    reasons.push("Sekce D — zpeněžení majetku");
  }

  if (/znalecký\s+posudek/.test(desc)) {
    score += 15;
    reasons.push("Znalecký posudek dostupný");
  }

  if (/návrh\s+na\s+zpeněžení\s+mimo\s+dražb[uů]/.test(desc)) {
    score += 25;
    reasons.push("Návrh na zpeněžení mimo dražbu = přímý prodej");
  }

  if (/návrh\s+na\s+zpeněžení\s+dražb[uů]/.test(desc)) {
    score += 5;
    reasons.push("Návrh na zpeněžení dražbou");
  }

  if (/soupis\s+majetkové\s+podstaty/.test(desc)) {
    score += 10;
    reasons.push("Soupis majetkové podstaty");
  }

  if (/oddlužení/.test(desc)) {
    score += 5;
    reasons.push("Řízení o oddlužení");
  }

  if (apartment.disposition) {
    const disp = apartment.disposition;
    if (disp === "1+kk" || disp === "2+kk" || disp === "1+1" || disp === "2+1") {
      score += 5;
      reasons.push(`Dispozice ${disp} — nejlikvidnější`);
    }
  }

  if (apartment.address) {
    const addrLower = apartment.address.toLowerCase();
    if (addrLower.includes("praha") || addrLower.includes("brno")) {
      score += 5;
      reasons.push("Lokalita Praha/Brno — vysoká poptávka");
    }
  }

  if (apartment.estimatedPrice && apartment.estimatedPrice > 1000000) {
    score += 5;
    reasons.push("Odhadní cena nad 1 mil. Kč");
  }

  const daysSincePublished = Math.floor((Date.now() - publishedAt) / (1000 * 60 * 60 * 24));
  if (daysSincePublished > 180) {
    score -= 15;
    reasons.push("Starší než 6 měsíců");
  }

  if (!apartment.address && !apartment.disposition) {
    score -= 10;
    reasons.push("Chybí adresa i dispozice");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
