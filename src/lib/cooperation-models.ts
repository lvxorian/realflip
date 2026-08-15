// Sdílený zdroj modelů spolupráce — bez jakýchkoli importů, takže ho smí
// používat server (API/validace) i client komponenty (selecty v UI).
// Jediné místo, kde se modely/labely mění.

export const COOPERATION_MODELS = {
  flip: "Flip a prodej",
  rent: "Nákup a držení",
} as const;

export type CooperationModel = keyof typeof COOPERATION_MODELS;

export function modelLabel(model: string | null | undefined): string {
  return model && model in COOPERATION_MODELS ? COOPERATION_MODELS[model as CooperationModel] : "Flexibilní — bez omezení";
}

/** Způsob spolupráce u flipu: 50/50 (my zajišťujeme rekonstrukci, zisk napůl)
 *  vs. sourcing fee (investor kupuje sám, platí nám poplatek za sourcing). */
export const COOPERATION_STRATEGIES = {
  "fifty-fifty": "50/50",
  "sourcing-fee": "Sourcing fee",
} as const;

export type CooperationStrategy = keyof typeof COOPERATION_STRATEGIES;

/** Dostupnost strategií pro konkrétní obchod: investor si vybere (obojí),
 *  nebo je obchod nabízen jen v jednom režimu. */
export const COOPERATION_AVAILABILITY = ["both", "fifty-fifty", "sourcing-fee"] as const;

export type CooperationAvailability = (typeof COOPERATION_AVAILABILITY)[number];

export const COOPERATION_AVAILABILITY_LABELS: Record<CooperationAvailability, string> = {
  both: "Obojí — investor si vybere",
  "fifty-fifty": "50/50",
  "sourcing-fee": "Sourcing fee",
};

export function strategiesFromAvailability(
  availability: CooperationAvailability | string | null | undefined
): CooperationStrategy[] {
  if (availability === "fifty-fifty") return ["fifty-fifty"];
  if (availability === "sourcing-fee") return ["sourcing-fee"];
  return ["fifty-fifty", "sourcing-fee"];
}
