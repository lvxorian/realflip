import { FullAnalysis, RedFlag, DetailedCosts, BuildingType, EnergyLabel, OccupancyStatus, LocationCategory, RenovationItem, ScenarioResult, CitySegments } from "./types";
import { classifyLocation } from "./location";
import { EUPHEMISMS, MARKET_DATA } from "./market-data";
import { RawListing } from "../scraping/types";

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

function detectSegmentKey(condition: string | null, buildingType: BuildingType): keyof CitySegments {
  const needsRenov = condition === "original" || condition === "dilapidated";
  const isPanel = buildingType === "panel";
  if (isPanel && needsRenov) return "panel_needs_renov";
  if (isPanel) return "panel_renovated";
  if (needsRenov) return "brick_needs_renov";
  return "brick_renovated";
}

function calculateMarketPriceRange(
  segments: CitySegments | null,
  locationCategory: LocationCategory,
  buildingType: BuildingType,
  condition: string | null
): { low: number; high: number } {
  if (segments) {
    const key = detectSegmentKey(condition, buildingType);
    const range = segments[key];
    if (locationCategory === "risky") {
      return { low: Math.round(range.low * 0.5), high: Math.round(range.high * 0.5) };
    }
    return range;
  }

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

  if (low === 0) { low = 30000; high = 80000; }
  return { low, high };
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

function calculateItemizedRenovation(area: number, condition: string | null): RenovationItem[] {
  const needsFull = condition === "original" || condition === "dilapidated";
  const needsMedium = condition === "good" || !condition;
  const needsLight = condition === "new" || condition === "renovated";

  const items: RenovationItem[] = [];

  // Bourání
  items.push({ category: "Bourání a přípravné práce", estimatedCost: Math.round(area * (needsFull ? 600 : 300)), note: needsFull ? "Plné bourání" : "Částečné úpravy" });

  // Elektrika
  items.push({ category: "Elektroinstalace", estimatedCost: Math.round(area * (needsFull ? 1800 : needsMedium ? 1200 : 400)), note: needsFull ? "Kompletní nová" : needsMedium ? "Částečná" : "Drobné úpravy" });

  // Voda + topení
  items.push({ category: "Vodoinstalace a topení", estimatedCost: Math.round(area * (needsFull ? 2000 : needsMedium ? 1400 : 500)), note: needsFull ? "Kompletní nové" : needsMedium ? "Částečná" : "Drobné úpravy" });

  // Podlahy
  items.push({ category: "Podlahy", estimatedCost: Math.round(area * (needsFull ? 1500 : needsMedium ? 1000 : 600)), note: needsFull ? "Včetně vyrovnání" : "Přebroušení/položení" });

  // Malby + omítky
  items.push({ category: "Malby a omítky", estimatedCost: Math.round(area * (needsFull ? 800 : needsMedium ? 500 : 300)), note: needsFull ? "Nové omítky" : "Přemalování" });

  // Koupelna (estimated as flat cost based on condition)
  const bathroomCost = needsFull ? 250000 : needsMedium ? 180000 : 80000;
  items.push({ category: "Koupelna", estimatedCost: bathroomCost, note: needsFull ? "Kompletní rekonstrukce" : "Částečná" });

  // Kuchyně
  const kitchenCost = needsFull ? 200000 : needsMedium ? 140000 : 60000;
  items.push({ category: "Kuchyně", estimatedCost: kitchenCost, note: needsFull ? "Nová kuchyně vč. spotřebičů" : needsMedium ? "Nová linka" : "Drobné úpravy" });

  // Okna + dveře
  items.push({ category: "Okna a dveře", estimatedCost: Math.round(area * (needsFull ? 1200 : needsMedium ? 600 : 200)), note: needsFull ? "Nová okna" : needsMedium ? "Částečná výměna" : "Údržba" });

  return items;
}

function calculateScenario(
  label: string,
  purchasePrice: number,
  area: number,
  condition: string | null,
  marketPriceHigh: number,
  renovationMultiplier: number,
  arvMultiplier: number,
  timelineMonths: number
): ScenarioResult {
  const items = calculateItemizedRenovation(area, condition);
  const renovationCost = Math.round(items.reduce((s, i) => s + i.estimatedCost, 0) * renovationMultiplier);
  const arv = Math.round(marketPriceHigh * area * arvMultiplier);

  const commission = Math.round(purchasePrice * 0.04);
  const legalFees = 25000;
  const appraisalFee = 8000;
  const holdingCosts = Math.round((purchasePrice + renovationCost) * 0.005 * timelineMonths);
  const sellingCommission = Math.round(arv * 0.04);
  const homeStaging = 35000;
  const certificates = 10000;
  const grossProfit = arv - purchasePrice - commission - legalFees - appraisalFee - renovationCost - holdingCosts - sellingCommission - homeStaging - certificates;
  const incomeTax = grossProfit > 0 ? Math.round(grossProfit * 0.15) : 0;
  const totalCost = purchasePrice + commission + legalFees + appraisalFee + renovationCost + holdingCosts + sellingCommission + homeStaging + certificates + incomeTax;
  const netProfit = arv - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const annualizedRoi = timelineMonths > 0 ? (roi / timelineMonths) * 12 : 0;

  return { label, renovationCost, arv, totalCost, netProfit, roi: Math.round(roi * 10) / 10, annualizedRoi: Math.round(annualizedRoi * 10) / 10 };
}

function determineVerdict(
  investmentScore: number,
  locationCategory: LocationCategory,
  overpricingPct: number,
  occupancy: OccupancyStatus,
  redFlags: RedFlag[],
  scenarios: FullAnalysis["scenarios"]
): { verdictLevel: FullAnalysis["verdictLevel"]; recommendation: "buy" | "consider" | "skip"; summary: string } {
  const highRedFlags = redFlags.filter((f) => f.severity === "high").length;
  const { conservative } = scenarios;

  if (occupancy === "occupied" && locationCategory !== "premium") {
    return {
      verdictLevel: "categoricalReject",
      recommendation: "skip",
      summary: "Obsazeno nájemníkem v neprémiové lokalitě — reflip nemožný bez nákladného vystěhování",
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

  if (conservative.roi >= 15 && overpricingPct <= 0 && occupancy === "free" && highRedFlags === 0) {
    return {
      verdictLevel: "strongBuy",
      recommendation: "buy",
      summary: `Silný kandidát — skóre ${investmentScore}, konzervativní ROI ${conservative.roi.toFixed(1)} %, volný byt`,
    };
  }

  if (conservative.roi >= 10 && overpricingPct <= 10 && occupancy !== "occupied") {
    return {
      verdictLevel: "buy",
      recommendation: "buy",
      summary: `Doporučeno ke koupi — skóre ${investmentScore}, marže ${conservative.roi.toFixed(1)} %`,
    };
  }

  if (conservative.roi >= 5) {
    return {
      verdictLevel: "consider",
      recommendation: "consider",
      summary: `Zvažit s opatrností — skóre ${investmentScore}, marže ${conservative.roi.toFixed(1)} %, nutná due diligence`,
    };
  }

  if (conservative.netProfit <= 0) {
    return {
      verdictLevel: "categoricalReject",
      recommendation: "skip",
      summary: "Reflip generuje ztrátu — kategoricky odmítnout",
    };
  }

  return {
    verdictLevel: "dontBuy",
    recommendation: "skip",
    summary: `Nízká marže (${conservative.roi.toFixed(1)} %) nebo příliš mnoho rizikových signálů`,
  };
}

export function analyzeListing(listing: RawListing): FullAnalysis {
  const { price, area, rooms, condition, description, title, address, yearBuilt } = listing;

  // Krok 1: Základní parametry
  const usableArea = area ?? 70;
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

  // Krok 3: Cenová analýza — POUŽÍVÁ MARKET_DATA SEGMENTY
  const buildingType = detectBuildingType(description, title);
  const marketRange = calculateMarketPriceRange(location.segments, location.category, buildingType, condition);
  const overpricingPct = marketRange.high > 0 ? ((pricePerSqm - marketRange.high) / marketRange.high) * 100 : 0;

  // Krok 4: Dispozice
  const segmentRating = rateSegment(area, rooms);

  // Krok 5: Obsazenost
  const occupancy = detectOccupancy(description, title);

  // Krok 6: Technický stav
  const energyLabel = detectEnergyLabel(description);
  const technicalScore = calculateTechnicalScore(condition, energyLabel, yearBuilt, buildingType);

  // Krok 7: Red flags
  const redFlags = detectRedFlags(description, title, pricePerSqm, overpricingPct, location.category);

  // Krok 8: Itemizovaná rekonstrukce
  const renovationItems = calculateItemizedRenovation(usableArea, condition);

  // Krok 9: 3 scénáře
  const marketPriceHigh = marketRange.high;
  const scenarios = {
    optimistic: calculateScenario("Optimistický", price, usableArea, condition, marketPriceHigh, 0.85, 1.2, 4),
    conservative: calculateScenario("Konzervativní", price, usableArea, condition, marketPriceHigh, 1.0, 1.05, 6),
    pessimistic: calculateScenario("Pesimistický", price, usableArea, condition, marketPriceHigh, 1.3, 0.9, 9),
  };

  // Hlavní kalkulace používá konzervativní scénář
  const flip = scenarios.conservative;
  const renovationTotal = flip.renovationCost;

  const commission = Math.round(price * 0.04);
  const legalFees = 25000;
  const appraisalFee = 8000;
  const holdingCosts = Math.round((price + renovationTotal) * 0.005 * 6);
  const sellingCommission = Math.round(flip.arv * 0.04);
  const homeStaging = 35000;
  const certificates = 10000;
  const grossProfit = flip.arv - price - commission - legalFees - appraisalFee - renovationTotal - holdingCosts - sellingCommission - homeStaging - certificates;
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
  const annualizedRoi = roi / 6 * 12;

  // Investment score
  const undervaluationPct = marketRange.high > 0 ? ((marketRange.high - pricePerSqm) / marketRange.high) * 100 : 0;
  const scoreComponents = {
    undervaluation: Math.min(Math.max(0, (undervaluationPct / 30) * 40), 40),
    roi: Math.min(Math.max(0, (flip.roi / 30) * 25), 25),
    timeline: Math.max(0, 15 - 6),
    condition: condition === "original" || condition === "dilapidated" ? 10 : condition === "good" ? 5 : 0,
    marketConfidence: marketRange.high > 0 ? 10 : 0,
  };
  const investmentScore = Math.round(
    scoreComponents.undervaluation +
    scoreComponents.roi +
    scoreComponents.timeline +
    scoreComponents.condition +
    scoreComponents.marketConfidence
  );

  // Cílový nákup
  const TARGET_ROI = 0.15;
  const taxRate = 0.15;
  const grossTargetRatio = TARGET_ROI / (1 - taxRate);
  const targetMultiple = 1 + grossTargetRatio;
  const targetTotalCost = flip.arv / targetMultiple;
  const acqCostRate = 0.04;
  const holdingCostRate = 0.005 * 6;
  const fixedAcqCosts = 33000;
  const sellingCostsCalc = Math.round(flip.arv * 0.04) + 45000;
  const totalCostNoRenov = 1 + acqCostRate + holdingCostRate * (1 + acqCostRate);
  const targetPurchasePrice = Math.round(
    (targetTotalCost - (1 + holdingCostRate) * renovationTotal - sellingCostsCalc - fixedAcqCosts * (1 + holdingCostRate)) / totalCostNoRenov
  );
  const priceReductionNeeded = Math.max(0, price - targetPurchasePrice);
  const priceReductionPct = price > 0 ? Math.round((priceReductionNeeded / price) * 100 * 10) / 10 : 0;

  // Krok 10: Alternativy
  const rentalYield = calculateRentalYield(price, usableArea);
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

  // Krok 11: Verdikt
  const { verdictLevel, recommendation, summary } = determineVerdict(
    investmentScore,
    location.category,
    overpricingPct,
    occupancy,
    redFlags,
    scenarios
  );

  return {
    pricePerSqm,
    missingFields,
    location,
    marketPricePerSqmLow: marketRange.low,
    marketPricePerSqmHigh: marketRange.high,
    overpricingPct: Math.round(overpricingPct * 10) / 10,
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
    annualizedRoi: Math.round(annualizedRoi * 10) / 10,
    cashOnCash: costs.purchasePrice > 0 ? Math.round((netProfit / costs.purchasePrice) * 100 * 10) / 10 : 0,
    breakEvenPrice: Math.round(costs.totalCost - netProfit * 0.5),
    rentalYield: rentalYield ? Math.round(rentalYield * 10) / 10 : null,
    alternativeStrategies,
    investmentScore,
    recommendation,
    verdictLevel,
    verdictSummary: summary,
    targetPurchasePrice,
    priceReductionNeeded,
    priceReductionPct,
    targetROI: TARGET_ROI * 100,
    scenarios,
    renovationItems,
  };
}
