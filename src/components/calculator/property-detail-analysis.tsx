"use client";

import InteractiveAnalysis from "./interactive-analysis";

interface PropertyData {
  id: string;
  title: string;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  rooms: string | null;
  floor: number | null;
  condition: string | null;
  buildingType: string | null;
  yearBuilt: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  contactPhone: string | null;
  contactName: string | null;
  contactEmail: string | null;
  description: string | null;
  imageUrls: string[];
  url: string;
  portalName: string;
}

interface AnalysisData {
  id: string;
  marketValue: number | null;
  undervaluationPct: number | null;
  investmentScore: number | null;
  arv: number | null;
  renovationCost: number | null;
  totalCost: number | null;
  netProfit: number | null;
  roi: number | null;
  annualizedRoi: number | null;
  cashOnCash: number | null;
  breakEvenPrice: number | null;
  recommendation: string | null;
  pricePerSqm: number | null;
  marketPriceMin: number | null;
  marketPriceMax: number | null;
  overpricingPct: number | null;
  locationCategory: string | null;
  locationCity: string | null;
  locationDistrict: string | null;
  segmentRating: string | null;
  occupancy: string | null;
  buildingType: string | null;
  energyLabel: string | null;
  technicalScore: number | null;
  verdictLevel: string | null;
  verdictSummary: string | null;
  redFlagsJson: string | null;
  costsJson: string | null;
  alternativeStrategiesJson: string | null;
  rentalYield: number | null;
  aiReport: string | null;
  marketSource: string | null;
  marketSampleSize: number | null;
}

interface ParsedAiReport {
  summary?: string | null;
  sentiment?: string | null;
  maxBid?: number | null;
  negotiationTips?: string[] | null;
  redFlags?: string[] | null;
  hiddenInfo?: string[] | null;
  comparableNotes?: string | null;
}

/**
 * aiReport v DB může být buď JSON z analyzeListing (novější), nebo holý text
 * (starší záznamy / aukce). Vrátí rozparsovanou strukturu nebo null.
 */
function parseAiReport(raw: string | null): ParsedAiReport | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.summary === "string") {
      return parsed as ParsedAiReport;
    }
    // JSON bez summary — bereme jako prostý text
    if (typeof parsed === "string" && parsed.trim()) {
      return { summary: parsed };
    }
    return null;
  } catch {
    // Není JSON — holý textový summary
    return raw.trim() ? { summary: raw } : null;
  }
}

function buildAnalysisResult(
  property: PropertyData,
  analysis: AnalysisData | null
): any {
  const a = analysis;
  const aiReport = a?.aiReport ? parseAiReport(a.aiReport) : null;
  const arvValue = a?.arv ?? property.price;
  const roiValue = a?.roi ?? 0;
  const netProfitValue = a?.netProfit ?? 0;
  const totalCostValue = a?.totalCost ?? property.price;
  const marketLow = a?.marketPriceMin ?? 0;
  const marketHigh = a?.marketPriceMax ?? 0;

  return {
    url: property.url,
    portal: property.portalName,
    success: true,
    listing: {
      id: property.id,
      title: property.title,
      price: property.price,
      area: property.area,
      rooms: property.rooms,
      condition: property.condition,
      address: property.address,
      description: property.description,
      imageUrls: property.imageUrls.slice(0, 3),
      contactPhone: property.contactPhone,
      contactName: property.contactName,
      contactEmail: property.contactEmail,
    },
    analysis: {
      pricePerSqm: a?.pricePerSqm ?? property.pricePerSqm ?? 0,
      marketPricePerSqmLow: marketLow,
      marketPricePerSqmHigh: marketHigh,
      arvPricePerSqmHigh: a?.marketPriceMax ?? 0,
      marketSource: a?.marketSource ?? null,
      marketSampleSize: a?.marketSampleSize ?? null,
      undervaluationPct: a?.undervaluationPct ?? 0,
      overpricingPct: a?.overpricingPct ?? 0,
      investmentScore: a?.investmentScore ?? 0,
      verdictLevel: a?.verdictLevel ?? "consider",
      recommendation: a?.recommendation ?? "consider",
      verdictSummary: a?.verdictSummary ?? "",
      arv: arvValue,
      roi: roiValue,
      netProfit: netProfitValue,
      targetPurchasePrice: property.price,
      priceReductionNeeded: 0,
      priceReductionPct: 0,
      condition: property.condition,
      location: a?.locationCity
        ? { city: a.locationCity, category: a.locationCategory ?? "unknown" }
        : null,
      buildingType: a?.buildingType ?? property.buildingType ?? "",
      segmentRating: a?.segmentRating ?? "",
      occupancy: a?.occupancy ?? "",
      missingFields: [],
      redFlags: a?.redFlagsJson
        ? (JSON.parse(a.redFlagsJson) as { type: string; text: string; severity: string }[])
        : [],
      scenarios: {} as any,
    },
    aiSummary: aiReport?.summary ?? null,
    aiNegotiationTips: aiReport?.negotiationTips ?? null,
    aiComparableNotes: aiReport?.comparableNotes ?? null,
    aiHiddenInfo: aiReport?.hiddenInfo ?? null,
  };
}

export default function PropertyDetailAnalysis({
  property,
  analysis,
  negotiatedPrice = null,
}: {
  property: PropertyData;
  analysis: AnalysisData | null;
  negotiatedPrice?: number | null;
}) {
  const result = buildAnalysisResult(property, analysis);
  return <InteractiveAnalysis result={result} index={0} negotiatedPrice={negotiatedPrice} />;
}
