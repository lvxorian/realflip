import { CityMarketData } from "./types";

export const MARKET_DATA: Record<string, CityMarketData> = {
  praha: {
    districts: {
      premium: [
        "Vinohrady", "Karlín", "Vršovice", "Smíchov", "Podolí", "Bubeneč",
        "Dejvice", "Nusle", "Holešovice", "Nové Město", "Staré Město",
        "Malá Strana", "Hradčany", "Letná", "Braník", "Libuš",
      ],
      stable: [
        "Žižkov", "Vyšehrad", "Strašnice", "Michle",
        "Spořilov", "Modřany", "Chodov", "Lhotka", "Barrandov",
        "Bohnice", "Kobylisy", "Čimice", "Prosek", "Střížkov",
      ],
      risky: [
        "Háje", "Jižní Město", "Malešice", "Černý Most", "Horní Počernice",
        "Letňany", "Suchdol", "Ďáblice",
      ],
    },
    segments: {
      panel_needs_renov: { low: 70000, high: 100000 },
      panel_renovated: { low: 95000, high: 140000 },
      brick_needs_renov: { low: 90000, high: 130000 },
      brick_renovated: { low: 125000, high: 185000 },
    },
  },

  brno: {
    districts: {
      premium: [
        "Královo Pole", "Žabovřesky", "Masarykova čtvrť", "Stránice",
        "Veveří", "Ponava", "Černá Pole", "Štýřice",
        "Bohunice", "Kohoutovice", "Nový Lískovec", "Staré Brno",
      ],
      stable: [
        "Lesná", "Vinohrady", "Slatina", "Líšeň", "Bystrc",
        "Kníničky", "Ivanovice", "Medlánky", "Řečkovice",
      ],
      risky: ["Husovice", "Zábrdovice", "Cejl", "Trnitá"],
    },
    segments: {
      panel_needs_renov: { low: 55000, high: 80000 },
      panel_renovated: { low: 75000, high: 105000 },
      brick_needs_renov: { low: 70000, high: 95000 },
      brick_renovated: { low: 95000, high: 145000 },
    },
  },

  plzen: {
    districts: {
      premium: [
        "Východní Předměstí", "Jižní Předměstí", "Bory",
        "Slovany", "Lochotín",
      ],
      stable: ["Doubravka", "Skvrňany", "Božkov"],
      risky: ["Košutka", "Sulkov"],
    },
    segments: {
      panel_needs_renov: { low: 42000, high: 58000 },
      panel_renovated: { low: 58000, high: 78000 },
      brick_needs_renov: { low: 55000, high: 72000 },
      brick_renovated: { low: 72000, high: 100000 },
    },
  },

  ostrava: {
    districts: {
      premium: [
        "Moravská Ostrava", "Poruba", "Mariánské Hory",
        "Slezská Ostrava",
      ],
      stable: ["Ostrava-Jih", "Hrabůvka", "Zábřeh"],
      risky: ["Vítkovice", "Přívoz", "Hrušov"],
    },
    segments: {
      panel_needs_renov: { low: 22000, high: 35000 },
      panel_renovated: { low: 32000, high: 50000 },
      brick_needs_renov: { low: 28000, high: 42000 },
      brick_renovated: { low: 42000, high: 65000 },
    },
  },

  usti: {
    districts: {
      premium: ["Klíše", "Bukov", "Skřivánek"],
      stable: ["Střekov", "Severní Terasa", "Dobětice"],
      risky: ["Předlice", "Mojžíř", "Krásné Březno", "Neštěmice"],
    },
    segments: {
      panel_needs_renov: { low: 18000, high: 28000 },
      panel_renovated: { low: 28000, high: 42000 },
      brick_needs_renov: { low: 25000, high: 38000 },
      brick_renovated: { low: 38000, high: 55000 },
    },
  },

  olomouc: {
    districts: {
      premium: ["Centrum", "Nová Ulice", "Nové Sady", "Lazce"],
      stable: ["Hodolany", "Povel", "Neředín"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 38000, high: 52000 },
      panel_renovated: { low: 50000, high: 70000 },
      brick_needs_renov: { low: 45000, high: 60000 },
      brick_renovated: { low: 60000, high: 88000 },
    },
  },

  hradec: {
    districts: {
      premium: ["Centrum", "Pražské Předměstí"],
      stable: ["Slezské Předměstí", "Malšovice", "Třebeš"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 40000, high: 55000 },
      panel_renovated: { low: 55000, high: 75000 },
      brick_needs_renov: { low: 48000, high: 65000 },
      brick_renovated: { low: 65000, high: 92000 },
    },
  },

  pardubice: {
    districts: {
      premium: ["Centrum", "Zelené Předměstí", "Bílé Předměstí"],
      stable: ["Polabiny", "Dukla", "Cihelna"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 35000, high: 48000 },
      panel_renovated: { low: 48000, high: 65000 },
      brick_needs_renov: { low: 42000, high: 58000 },
      brick_renovated: { low: 58000, high: 82000 },
    },
  },

  ceske_budejovice: {
    districts: {
      premium: ["Centrum", "Sady", "Pražské Předměstí"],
      stable: ["České Vrbné", "Rožnov", "Suché Vrbné"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 38000, high: 52000 },
      panel_renovated: { low: 50000, high: 72000 },
      brick_needs_renov: { low: 45000, high: 62000 },
      brick_renovated: { low: 62000, high: 88000 },
    },
  },

  liberec: {
    districts: {
      premium: ["Centrum", "Ruprechtice", "Horní Růžodol"],
      stable: ["Vratislavice", "Kunratice"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 32000, high: 45000 },
      panel_renovated: { low: 45000, high: 65000 },
      brick_needs_renov: { low: 40000, high: 55000 },
      brick_renovated: { low: 55000, high: 78000 },
    },
  },

  karlovy_vary: {
    districts: {
      premium: ["Centrum", "Rybáře"],
      stable: ["Tuhnice", "Dražovice", "Stará Role"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 32000, high: 45000 },
      panel_renovated: { low: 45000, high: 65000 },
      brick_needs_renov: { low: 40000, high: 55000 },
      brick_renovated: { low: 55000, high: 80000 },
    },
  },

  mariansk_lazne: {
    districts: {
      premium: ["Centrum", "Kolonáda"],
      stable: ["Úšovice"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 30000, high: 42000 },
      panel_renovated: { low: 42000, high: 60000 },
      brick_needs_renov: { low: 38000, high: 52000 },
      brick_renovated: { low: 52000, high: 75000 },
    },
  },

  zlin: {
    districts: {
      premium: ["Centrum", "Letná"],
      stable: ["Zálešná", "Prštné"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 35000, high: 48000 },
      panel_renovated: { low: 48000, high: 68000 },
      brick_needs_renov: { low: 42000, high: 58000 },
      brick_renovated: { low: 58000, high: 85000 },
    },
  },

  kladno: {
    districts: { premium: ["Centrum", "Kročehlavy"], stable: ["Rozdělov", "Švermov"], risky: ["Dubí", "Sítná"] },
    segments: { panel_needs_renov: { low: 25000, high: 38000 }, panel_renovated: { low: 35000, high: 52000 }, brick_needs_renov: { low: 30000, high: 42000 }, brick_renovated: { low: 42000, high: 62000 } },
  },
  mlada_boleslav: {
    districts: { premium: ["Centrum"], stable: ["Mladá Boleslav II", "Podlázky"], risky: [] },
    segments: { panel_needs_renov: { low: 28000, high: 40000 }, panel_renovated: { low: 38000, high: 55000 }, brick_needs_renov: { low: 32000, high: 45000 }, brick_renovated: { low: 45000, high: 65000 } },
  },
  kolin: {
    districts: { premium: ["Centrum", "Zálabí"], stable: ["Heřmanův Městec", "Kmochův ostrov"], risky: [] },
    segments: { panel_needs_renov: { low: 25000, high: 36000 }, panel_renovated: { low: 35000, high: 50000 }, brick_needs_renov: { low: 30000, high: 42000 }, brick_renovated: { low: 42000, high: 58000 } },
  },
  jihlava: {
    districts: { premium: ["Centrum"], stable: ["Horní Kosov", "Pávov"], risky: [] },
    segments: { panel_needs_renov: { low: 30000, high: 42000 }, panel_renovated: { low: 42000, high: 58000 }, brick_needs_renov: { low: 35000, high: 48000 }, brick_renovated: { low: 48000, high: 70000 } },
  },
  karvina: {
    districts: { premium: [], stable: ["Mizerov", "Ráj"], risky: ["Fryštát", "Hranice"] },
    segments: { panel_needs_renov: { low: 12000, high: 20000 }, panel_renovated: { low: 20000, high: 32000 }, brick_needs_renov: { low: 16000, high: 25000 }, brick_renovated: { low: 25000, high: 38000 } },
  },
  havirov: {
    districts: { premium: [], stable: ["Město", "Podlesí"], risky: ["Šumbark", "Prostřední Suchá"] },
    segments: { panel_needs_renov: { low: 15000, high: 24000 }, panel_renovated: { low: 24000, high: 35000 }, brick_needs_renov: { low: 18000, high: 28000 }, brick_renovated: { low: 28000, high: 42000 } },
  },
  znojmo: {
    districts: { premium: ["Centrum"], stable: ["Pražské Sídliště", "Hájek"], risky: [] },
    segments: { panel_needs_renov: { low: 22000, high: 32000 }, panel_renovated: { low: 32000, high: 48000 }, brick_needs_renov: { low: 28000, high: 40000 }, brick_renovated: { low: 40000, high: 58000 } },
  },
  trebic: {
    districts: { premium: ["Centrum", "Borovina"], stable: ["Horka-Domky", "Stařečka"], risky: [] },
    segments: { panel_needs_renov: { low: 18000, high: 28000 }, panel_renovated: { low: 28000, high: 42000 }, brick_needs_renov: { low: 24000, high: 36000 }, brick_renovated: { low: 36000, high: 55000 } },
  },
  benesov: {
    districts: { premium: ["Centrum"], stable: ["Červené Vršky", "Pod Lhotou"], risky: [] },
    segments: { panel_needs_renov: { low: 28000, high: 38000 }, panel_renovated: { low: 38000, high: 55000 }, brick_needs_renov: { low: 32000, high: 45000 }, brick_renovated: { low: 45000, high: 65000 } },
  },
};

// Průměrné nájemné Kč/m²/měsíc dle města a kategorie lokality
export const RENT_PER_SQM: Record<string, { premium: number; stable: number; risky: number }> = {
  praha: { premium: 420, stable: 350, risky: 290 },
  brno: { premium: 310, stable: 260, risky: 230 },
  plzen: { premium: 260, stable: 225, risky: 200 },
  ostrava: { premium: 210, stable: 185, risky: 160 },
  usti: { premium: 190, stable: 165, risky: 140 },
  olomouc: { premium: 245, stable: 210, risky: 190 },
  hradec: { premium: 240, stable: 210, risky: 190 },
  pardubice: { premium: 235, stable: 205, risky: 185 },
  ceske_budejovice: { premium: 235, stable: 205, risky: 185 },
  liberec: { premium: 220, stable: 190, risky: 170 },
  karlovy_vary: { premium: 200, stable: 175, risky: 155 },
  mariansk_lazne: { premium: 200, stable: 175, risky: 155 },
  zlin: { premium: 215, stable: 190, risky: 170 },
  kladno: { premium: 195, stable: 175, risky: 155 },
  mlada_boleslav: { premium: 200, stable: 180, risky: 160 },
  kolin: { premium: 190, stable: 170, risky: 150 },
  jihlava: { premium: 195, stable: 175, risky: 155 },
  karvina: { premium: 150, stable: 135, risky: 120 },
  havirov: { premium: 145, stable: 130, risky: 115 },
  znojmo: { premium: 185, stable: 165, risky: 145 },
  trebic: { premium: 175, stable: 155, risky: 140 },
  benesov: { premium: 190, stable: 170, risky: 150 },
};

export const DEFAULT_RENT_PER_SQM = 250;

export function rentPerSqm(city: string | null | undefined, category?: string | null): number {
  const data = city ? RENT_PER_SQM[city] : undefined;
  if (!data) return DEFAULT_RENT_PER_SQM;
  const key = category === "premium" || category === "risky" ? category : "stable";
  return data[key];
}

export const RISKY_CITIES = [
  "Most", "Chomutov", "Karviná", "Havířov", "Bruntál",
  "Krnov", "Jeseník", "Litvínov", "Osek", "Jirkov",
];

export function conditionMultiplier(condition: string | null): number {
  switch (condition) {
    case "new": return 1.15;
    case "renovated": return 1.08;
    case "good": return 1.0;
    case "original": return 0.85;
    case "dilapidated": return 0.7;
    case "project": return 0.75;
    default: return 1.0;
  }
}

export function buildingTypeMultiplier(buildingType: string | null): number {
  return buildingType === "panel" ? 0.75 : 1.0;
}

export function categoryMultiplier(category: string | null | undefined): number {
  return category === "premium" ? 1.2 : category === "risky" ? 0.7 : 1.0;
}

const FALLBACK_RANGES: Record<"brick" | "other", Record<string, [number, number]>> = {
  brick: {
    new: [50000, 80000],
    renovated: [40000, 70000],
    good: [35000, 60000],
    original: [25000, 45000],
    dilapidated: [15000, 30000],
    default: [30000, 50000],
  },
  other: {
    new: [35000, 60000],
    renovated: [28000, 50000],
    good: [25000, 45000],
    original: [18000, 32000],
    dilapidated: [10000, 20000],
    default: [20000, 35000],
  },
};

export function hardcodedFallbackRange(
  condition: string | null,
  buildingType: string | null,
  category: string | null | undefined
): { low: number; high: number } {
  const useBrick = buildingType === "brick" || buildingType === "new" || buildingType === "mixed";
  const key = (condition ?? "default") as string;
  const table = useBrick ? FALLBACK_RANGES.brick : FALLBACK_RANGES.other;
  const range = table[key] ?? table.default;
  const cat = categoryMultiplier(category);
  return { low: Math.round(range[0] * cat), high: Math.round(range[1] * cat) };
}

export const EUPHEMISMS: { pattern: RegExp; meaning: string }[] = [
  { pattern: /specifický\s+charakter\s+lokality/i, meaning: "Problematická čtvrť" },
  { pattern: /oblíbená\s+lokalita/i, meaning: "RK nechce jmenovat konkrétní čtvrť" },
  { pattern: /dynamicky\s+se\s+rozvíjející/i, meaning: "V současnosti neatraktivní lokalita" },
  { pattern: /cenově\s+dostupné/i, meaning: "Horší lokalita" },
  { pattern: /oblíbená\s+část/i, meaning: "RK nechce jmenovat konkrétní čtvrť" },
  { pattern: /ideální\s+investiční\s+příležitost/i, meaning: "RK neuvádí konkrétní čísla" },
  { pattern: /vhodný\s+pro\s+nenáročné/i, meaning: "Špatný stav nebo lokalita" },
  { pattern: /stálý\s+nájemník/i, meaning: "Může být dávkový nájemník, obtížné vystěhování" },
  { pattern: /stálý\s+spolehlivý\s+nájemník/i, meaning: "Pravděpodobně dávkový nájemník" },
  { pattern: /výběr\s+kupujícího/i, meaning: "Vyhnutí se hypotečnímu odhadu" },
  { pattern: /byt\s+do\s+\d+\s*dnů\s+k\s*dispozici/i, meaning: "Čeká se na výpověď nájemníka" },
  { pattern: /pro\s+více\s+informací\s+volejte/i, meaning: "Lákací trik, chybí základní info" },
];
