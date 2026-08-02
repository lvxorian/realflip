/**
 * Reprodukční cena nemovitosti pro pojištění (jako Valuo reprodukční odhad).
 * Vychází z podlahové plochy × stavebních nákladů na m² dle typu konstrukce.
 * Zdrojem orientačních sazeb je obvyklá metodika pojišťoven (průměrné stavební náklady).
 */

export const REPLACEMENT_COST_PER_SQM: Record<string, number> = {
  brick: 38000, // cihelná konstrukce
  panel: 30000, // panelová
  mixed: 34000, // smíšená / skelet
  new: 42000, // novostavba / montovaná
  default: 35000,
};

const CONDITION_MULTIPLIER: Record<string, number> = {
  new: 1.15,
  renovated: 1.05,
  good: 1.0,
  original: 0.9,
  dilapidated: 0.75,
};

export interface ReplacementCostResult {
  costPerSqm: number;
  total: number;
  conditionAdjusted: number;
  buildingType: string | null;
  area: number;
}

/**
 * Spočítá reprodukční cenu pro pojištění.
 * `area` = podlahová plocha m², `buildingType` = brick/panel/mixed/new, `condition` = stav.
 * Vrací hrubou reprodukční cenu (nová hodnota) i upravenou o stav.
 */
export function calculateReplacementCost(input: {
  area: number | null;
  buildingType?: string | null;
  condition?: string | null;
}): ReplacementCostResult {
  const area = input.area ?? 70;
  const costPerSqm = REPLACEMENT_COST_PER_SQM[input.buildingType ?? "default"] ?? REPLACEMENT_COST_PER_SQM.default;
  const multiplier = CONDITION_MULTIPLIER[input.condition ?? "good"] ?? 1.0;

  const total = Math.round(area * costPerSqm);
  const conditionAdjusted = Math.round(total * multiplier);

  return {
    costPerSqm,
    total,
    conditionAdjusted,
    buildingType: input.buildingType ?? null,
    area,
  };
}
