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
}

function buildAnalysisResult(
  property: PropertyData,
  analysis: AnalysisData | null
): any {
  const a = analysis;
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
      title: property.title,
      price: property.price,
      area: property.area,
      rooms: property.rooms,
      condition: property.condition,
      address: property.address,
      description: property.description?.slice(0, 500),
      imageUrls: property.imageUrls.slice(0, 3),
      contactPhone: property.contactPhone,
      contactName: property.contactName,
      contactEmail: property.contactEmail,
    },
    analysis: {
      pricePerSqm: a?.pricePerSqm ?? property.pricePerSqm ?? 0,
      marketPricePerSqmLow: marketLow,
      marketPricePerSqmHigh: marketHigh,
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
    aiSummary: null,
    aiNegotiationTips: null,
    aiComparableNotes: null,
    aiHiddenInfo: null,
  };
}

export default function PropertyDetailAnalysis({
  property,
  analysis,
}: {
  property: PropertyData;
  analysis: AnalysisData | null;
}) {
  const result = buildAnalysisResult(property, analysis);
  return <InteractiveAnalysis result={result} index={0} />;
}
