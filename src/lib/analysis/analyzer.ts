import { FullAnalysis, RedFlag, DetailedCosts, BuildingType, EnergyLabel, OccupancyStatus, LocationCategory } from "./types";
import { classifyLocation } from "./location";
import { EUPHEMISMS } from "./market-data";
import { RawListing } from "../scraping/types";
import { calculateFlip } from "./flip-calculator";

function detectBuildingType(description: string | null, title: string | null): BuildingType {
  const text = [description, title].filter(Boolean).join(" ").toLowerCase();
  if (/cihlov[éý]/i.test(text)) return "brick";
  if (/panel[ovýáé]/.test(text)) return "panel";
  if (/novostavba|nov[ýá]\s+objekt/.test(text)) return "new";
  if (/smíšen[ýé]/.test(text)) return "mixed";
  return null;
}

function detectEnergyLabel(description: string | null): EnergyLabel {
  if (!description) return null;
  const text = description.toLowerCase();
  const match = text.match(/energetick[ýé]\s*(štítek|třída|trid[aá]).*?([a-g])/i);
  if (match) return match[2].toUpperCase() as EnergyLabel;
  const match2 = text.match(/(?:třída|trid[aá])\s*energetick[ée]\s*náročnosti.*?([a-g])/i);
  if (match2) return match2[1].toUpperCase() as EnergyLabel;
  return null;
}

function detectOccupancy(description: string | null, title: string | null): OccupancyStatus {
  const text = [description, title].filter(Boolean).join(" ").toLowerCase();
  if (/volný|ihned\s*k\s*dikci|dostupn[ýá]\s*ihned|okamžit[ěe]/.test(text)) return "free";
  if (/nájemník|pronajato|obsazeno|s\s*nájemníkem|nájemce/.test(text)) return "occupied";
  return "unknown";
}

function detectRedFlags(description: string | null, title: string | null, pricePerSqm: number, overpricingPct: number, locationCategory: LocationCategory): RedFlag[] {
  const flags: RedFlag[] = [];
  const text = [description, title].filter(Boolean).join(" ");

  if (!description || description.length < 20) {
    flags.push({ type: "missing_info", text: "Popisek je příliš krátký nebo chybí", severity: "medium" });
  }

  for (const ep of EUPHEMISMS) {
    if (ep.pattern.test(text)) {
      flags.push({ type: "euphemism", text: `Eufemismus: "${ep.pattern.source.replace(/\\/g, "").slice(0, 40)}" → ${ep.meaning}`, severity: "medium" });
    }
  }

  if (overpricingPct > 25) {
    flags.push({ type: "price_warning", text: `Cena je o ${overpricingPct.toFixed(0)} % nad tržním stropem`, severity: "high" });
  } else if (overpricingPct > 10) {
    flags.push({ type: "price_warning", text: `Cena je o ${overpricingPct.toFixed(0)} % nad tržním stropem`, severity: "medium" });
  }

  if (locationCategory === "risky") {
    flags.push({ type: "location_warning", text: "Riziková lokalita — omezený prodejní strop, nízká likvidita", severity: "high" });
  }

  if (/garáž|sklep|balkon|lodžie|terasa|výtah|parkování/.test(text)) {
    if (!/výtah/.test(text)) {
      flags.push({ type: "missing_info", text: "Není uvedeno, zda je v domě výtah", severity: "low" });
    }
    if (!/balkon|lodžie|terasa/.test(text)) {
      flags.push({ type: "missing_info", text: "Není uveden balkon/lodžie/terasa", severity: "low" });
    }
    if (!/sklep|komora/.test(text)) {
      flags.push({ type: "missing_info", text: "Není uveden sklep/komora", severity: "low" });
    }
  }

  if (/pro\s+více\s+informací\s+volejte/i.test(text)) {
    flags.push({ type: "missing_info", text: "Inzerát obsahuje 'pro více info volejte' — chybí základní údaje", severity: "medium" });
  }

  return flags;
}

function calculateOverpricing(
  pricePerSqm: number,
  locationCategory: LocationCategory,
  buildingType: BuildingType,
  condition: string | null
): { low: number; high: number; overpricingPct: number } {
  const useRenovated = condition === "new" || condition === "renovated" || condition === "good";
  const useBrick = buildingType === "brick" || buildingType === "new";
  const other = buildingType === "panel" || buildingType === null;

  let low = 0, high = 0;

  if (useBrick) {
    low = useRenovated ? 130000 : 110000;
    high = useRenovated ? 220000 : 160000;
  } else if (other) {
    low = useRenovated ? 110000 : 90000;
    high = useRenovated ? 160000 : 130000;
  }

  if (locationCategory === "risky") {
    low = Math.round(low * 0.5);
    high = Math.round(high * 0.5);
  }

  if (low === 0) {
    low = 30000;
    high = 80000;
  }

  const overpricingPct = high > 0 ? ((pricePerSqm - high) / high) * 100 : 0;
  return { low, high, overpricingPct };
}

function rateSegment(area: number | null, rooms: string | null): "best" | "good" | "ok" | "niche" | "poor" {
  if (area !== null) {
    if (area >= 45 && area <= 75) return "best";
    if (area >= 75 && area <= 100) return "good";
    if (area >= 25 && area < 45) return "ok";
    if (area < 25) return "niche";
    if (area > 100) return "niche";
  }
  if (rooms) {
    const r = rooms.replace(/\s/g, "");
    if (/^[23]\+/.test(r)) return "best";
    if (/^4\+/.test(r)) return "good";
    if (/^1\+/.test(r)) return "ok";
  }
  return "ok";
}

function calculateTechnicalScore(
  condition: string | null,
  energyLabel: EnergyLabel,
  yearBuilt: number | null,
  buildingType: BuildingType
): number {
  let score = 50;

  if (condition === "new" || condition === "renovated") score += 20;
  else if (condition === "good") score += 10;
  else if (condition === "original") score += 5;
  else if (condition === "dilapidated") score -= 10;

  if (energyLabel === "A" || energyLabel === "B") score += 15;
  else if (energyLabel === "C") score += 10;
  else if (energyLabel === "D") score += 5;
  else if (energyLabel === "E") score += 0;
  else if (energyLabel === "F" || energyLabel === "G") score -= 20;

  if (yearBuilt && yearBuilt > 2010) score += 15;
  else if (yearBuilt && yearBuilt > 2000) score += 10;
  else if (yearBuilt && yearBuilt > 1990) score += 5;
  else if (yearBuilt && yearBuilt < 1970) score -= 5;

  if (buildingType === "brick") score += 10;
  else if (buildingType === "new") score += 15;
  else if (buildingType === "panel") score -= 5;

  return Math.max(0, Math.min(100, score));
}

function calculateRentalYield(price: number, area: number | null): number | null {
  if (!area || price <= 0) return null;
  const estimatedRent = area * 250;
  const annualRent = estimatedRent * 12;
  return (annualRent / price) * 100;
}

function determineVerdict(
  investmentScore: number,
  locationCategory: LocationCategory,
  overpricingPct: number,
  occupancy: OccupancyStatus,
  redFlags: RedFlag[],
  netProfit: number,
  roi: number
): { verdictLevel: FullAnalysis["verdictLevel"]; recommendation: "buy" | "consider" | "skip"; summary: string } {
  const highRedFlags = redFlags.filter((f) => f.severity === "high").length;
  const hasOccupied = occupancy === "occupied";

  if (occupancy === "occupied" && locationCategory !== "premium") {
    return {
      verdictLevel: "categoricalReject",
      recommendation: "skip",
      summary: "Obsazeno nájemníkem v nerpémiové lokalitě — reflip nemožný bez nákladného vystěhování",
    };
  }

  if (overpricingPct > 50) {
    return {
      verdictLevel: "categoricalReject",
      recommendation: "skip",
      summary: `Cena je o ${overpricingPct.toFixed(0)} % nad trhem — past pro začátečníky`,
    };
  }

  if (overpricingPct > 25 || locationCategory === "risky") {
    return {
      verdictLevel: "dontBuy",
      recommendation: "skip",
      summary: locationCategory === "risky"
        ? "Riziková lokalita s omezeným prodejním stropem"
        : `Výrazně přeplaceno (${overpricingPct.toFixed(0)} % nad trhem)`,
    };
  }

  if (investmentScore >= 70 && overpricingPct <= 0 && occupancy === "free" && highRedFlags === 0) {
    return {
      verdictLevel: "strongBuy",
      recommendation: "buy",
      summary: `Silný kandidát — skóre ${investmentScore}, pod tržní cenou, volný byt, prémiová lokalita`,
    };
  }

  if (investmentScore >= 50 && overpricingPct <= 10 && occupancy !== "occupied") {
    return {
      verdictLevel: "buy",
      recommendation: "buy",
      summary: `Doporučeno ke koupi — skóre ${investmentScore}, marže ${roi.toFixed(1)} %`,
    };
  }

  if (investmentScore >= 30 && roi >= 5) {
    return {
      verdictLevel: "consider",
      recommendation: "consider",
      summary: `Zvažit s opatrností — skóre ${investmentScore}, marže ${roi.toFixed(1)} %, nutná due diligence`,
    };
  }

  if (netProfit <= 0) {
    return {
      verdictLevel: "categoricalReject",
      recommendation: "skip",
      summary: "Reflip generuje ztrátu — kategoricky odmítnout",
    };
  }

  return {
    verdictLevel: "dontBuy",
    recommendation: "skip",
    summary: `Nízká marže (${roi.toFixed(1)} %) nebo příliš mnoho rizikových signálů`,
  };
}

export function analyzeListing(listing: RawListing): FullAnalysis {
  const { price, area, rooms, condition, description, title, address, yearBuilt } = listing;

  // Krok 1: Základní parametry
  const pricePerSqm = area && area > 0 ? Math.round(price / area) : 0;
  const missingFields: string[] = [];
  if (!area) missingFields.push("užitná plocha");
  if (!rooms) missingFields.push("dispozice");
  if (!condition) missingFields.push("stav nemovitosti");
  if (!address) missingFields.push("adresa");
  if (!yearBuilt) missingFields.push("rok výstavby");
  if (!listing.floor) missingFields.push("patro");
  if (!description) missingFields.push("popis");

  // Krok 2: Lokalita
  const location = classifyLocation(address, title);

  // Krok 3: Cenová analýza
  const overpricing = calculateOverpricing(pricePerSqm, location.category, detectBuildingType(description, title), condition);

  // Krok 4: Dispozice
  const segmentRating = rateSegment(area, rooms);

  // Krok 5: Obsazenost
  const occupancy = detectOccupancy(description, title);

  // Krok 6: Technický stav
  const buildingType = detectBuildingType(description, title);
  const energyLabel = detectEnergyLabel(description);
  const technicalScore = calculateTechnicalScore(condition, energyLabel, yearBuilt, buildingType);

  // Krok 7: Red flags
  const redFlags = detectRedFlags(description, title, pricePerSqm, overpricing.overpricingPct, location.category);

  // Krok 8: Full kalkulace
  const flipInput = {
    purchasePrice: price,
    area: area ?? 70,
    condition: (condition as any) ?? "good",
    renovationLevel: "medium" as const,
    timelineMonths: 6,
    marketValue: Math.round(price * 1.15),
  };
  const flip = calculateFlip(flipInput);

  const commission = Math.round(price * 0.04);
  const legalFees = 25000;
  const appraisalFee = 8000;
  const renovationTotal = flip.renovationCost;
  const holdingCosts = Math.round(flip.totalCost * 0.005 * 6);
  const sellingCommission = Math.round(flip.arv * 0.04);
  const homeStaging = 35000;
  const certificates = 10000;
  const grossProfit = flip.arv - flip.totalCost;
  const incomeTax = grossProfit > 0 ? Math.round(grossProfit * 0.15) : 0;

  const costs: DetailedCosts = {
    purchasePrice: price,
    commission,
    legalFees,
    appraisalFee,
    renovationCost: renovationTotal,
    holdingCosts,
    sellingCommission,
    homeStaging,
    certificates,
    incomeTax,
    totalCost: price + commission + legalFees + appraisalFee + renovationTotal + holdingCosts + sellingCommission + homeStaging + certificates + incomeTax,
  };

  const netProfit = flip.arv - costs.totalCost;
  const roi = costs.totalCost > 0 ? (netProfit / costs.totalCost) * 100 : 0;

  // Krok 9: Alternativy
  const rentalYield = calculateRentalYield(price, area ?? 70);
  const alternativeStrategies: string[] = [];
  if (rentalYield && rentalYield >= 5) {
    alternativeStrategies.push(`Dlouhodobý pronájem (výnosnost ${rentalYield.toFixed(1)} % p.a.)`);
  }
  if (location.category === "premium" && rentalYield && rentalYield >= 4) {
    alternativeStrategies.push("BRRRR strategie (Buy-Rehab-Rent-Refinance-Repeat)");
  }
  if (location.city === "praha" || location.city === "karlovy_vary" || location.city === "mariansk_lazne") {
    alternativeStrategies.push("Krátkodobý pronájem (Airbnb) — ověřit povolení SVJ a regulace");
  }

  // Krok 10: Verdikt
  const { verdictLevel, recommendation, summary } = determineVerdict(
    flip.investmentScore,
    location.category,
    overpricing.overpricingPct,
    occupancy,
    redFlags,
    netProfit,
    roi
  );

  return {
    pricePerSqm,
    missingFields,
    location,
    marketPricePerSqmLow: overpricing.low,
    marketPricePerSqmHigh: overpricing.high,
    overpricingPct: Math.round(overpricing.overpricingPct * 10) / 10,
    segmentRating,
    occupancy,
    buildingType,
    energyLabel,
    technicalScore,
    redFlags,
    costs,
    arv: flip.arv,
    netProfit,
    roi: Math.round(roi * 10) / 10,
    annualizedRoi: Math.round(flip.annualizedRoi * 10) / 10,
    cashOnCash: Math.round(flip.cashOnCash * 10) / 10,
    breakEvenPrice: flip.breakEvenPrice,
    rentalYield: rentalYield ? Math.round(rentalYield * 10) / 10 : null,
    alternativeStrategies,
    investmentScore: flip.investmentScore,
    recommendation,
    verdictLevel,
    verdictSummary: summary,
  };
}
