/**
 * Kriminalita PČR není dostupná jako strojové API na úrovni obcí.
 * Používáme index kriminality podle krajů (PČR, veřejně publikovaný) jako hrubý signál.
 * Data lze v budoucnu nahradit mapakriminality.cz exportem.
 */
export const CRIME_INDEX_BY_REGION: Record<string, number> = {
  praha: 480,
  stredocesky: 310,
  jihocesky: 260,
  plzensky: 260,
  karlovarsky: 330,
  ustecky: 390,
  liberecky: 300,
  kralovehradecky: 260,
  pardubicky: 240,
  vysocina: 230,
  jihomoravsky: 290,
  olomoucky: 280,
  zlinsky: 250,
  moravskoslezsky: 370,
};

/** Mapování cityKey -> kraj (pro přiřazení indexu kriminality). */
export const CITY_TO_REGION: Record<string, string> = {
  praha: "praha",
  brno: "jihomoravsky",
  plzen: "plzensky",
  ostrava: "moravskoslezsky",
  usti: "ustecky",
  olomouc: "olomoucky",
  hradec: "kralovehradecky",
  pardubice: "pardubicky",
  liberec: "liberecky",
  zlin: "zlinsky",
  karlovy_vary: "karlovarsky",
  jihlava: "vysocina",
  ceske_budejovice: "jihocesky",
};

export function crimeIndexForCity(cityKey: string): number | null {
  const region = CITY_TO_REGION[cityKey];
  if (!region) return null;
  return CRIME_INDEX_BY_REGION[region] ?? null;
}
