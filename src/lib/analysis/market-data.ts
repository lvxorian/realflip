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
        "Žižkov", "Vyšehrad", "Strašnice", "Vršovice", "Michle",
        "Spořilov", "Modřany", "Chodov", "Lhotka", "Barrandov",
        "Bohnice", "Kobylisy", "Čimice", "Prosek", "Střížkov",
      ],
      risky: [
        "Háje", "Jižní Město", "Malešice", "Černý Most", "Horní Počernice",
        "Letňany", "Suchdol", "Ďáblice",
      ],
    },
    segments: {
      panel_needs_renov: { low: 90000, high: 130000 },
      panel_renovated: { low: 110000, high: 160000 },
      brick_needs_renov: { low: 110000, high: 160000 },
      brick_renovated: { low: 130000, high: 220000 },
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
      panel_needs_renov: { low: 55000, high: 75000 },
      panel_renovated: { low: 70000, high: 100000 },
      brick_needs_renov: { low: 65000, high: 90000 },
      brick_renovated: { low: 85000, high: 130000 },
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
      panel_needs_renov: { low: 45000, high: 65000 },
      panel_renovated: { low: 60000, high: 85000 },
      brick_needs_renov: { low: 55000, high: 75000 },
      brick_renovated: { low: 70000, high: 100000 },
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
      panel_needs_renov: { low: 25000, high: 40000 },
      panel_renovated: { low: 35000, high: 55000 },
      brick_needs_renov: { low: 30000, high: 45000 },
      brick_renovated: { low: 40000, high: 65000 },
    },
  },

  usti: {
    districts: {
      premium: ["Klíše", "Bukov", "Skřivánek"],
      stable: ["Střekov", "Severní Terasa", "Dobětice"],
      risky: ["Předlice", "Mojžíř", "Krásné Březno", "Neštěmice"],
    },
    segments: {
      panel_needs_renov: { low: 25000, high: 35000 },
      panel_renovated: { low: 40000, high: 55000 },
      brick_needs_renov: { low: 32000, high: 45000 },
      brick_renovated: { low: 55000, high: 75000 },
    },
  },

  olomouc: {
    districts: {
      premium: ["Centrum", "Nová Ulice", "Nové Sady", "Lazce"],
      stable: ["Hodolany", "Povel", "Neředín"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 40000, high: 55000 },
      panel_renovated: { low: 55000, high: 80000 },
      brick_needs_renov: { low: 45000, high: 65000 },
      brick_renovated: { low: 65000, high: 95000 },
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
      panel_renovated: { low: 55000, high: 80000 },
      brick_needs_renov: { low: 45000, high: 65000 },
      brick_renovated: { low: 65000, high: 95000 },
    },
  },

  pardubice: {
    districts: {
      premium: ["Centrum", "Zelené Předměstí", "Bílé Předměstí"],
      stable: ["Polabiny", "Dukla", "Cihelna"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 35000, high: 50000 },
      panel_renovated: { low: 50000, high: 70000 },
      brick_needs_renov: { low: 40000, high: 60000 },
      brick_renovated: { low: 60000, high: 90000 },
    },
  },

  ceske_budejovice: {
    districts: {
      premium: ["Centrum", "Sady", "Pražské Předměstí"],
      stable: ["České Vrbné", "Rožnov", "Suché Vrbné"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 40000, high: 55000 },
      panel_renovated: { low: 55000, high: 80000 },
      brick_needs_renov: { low: 45000, high: 65000 },
      brick_renovated: { low: 65000, high: 95000 },
    },
  },

  liberec: {
    districts: {
      premium: ["Centrum", "Ruprechtice", "Horní Růžodol"],
      stable: ["Vratislavice", "Kunratice"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 35000, high: 50000 },
      panel_renovated: { low: 50000, high: 70000 },
      brick_needs_renov: { low: 40000, high: 60000 },
      brick_renovated: { low: 60000, high: 85000 },
    },
  },

  karlovy_vary: {
    districts: {
      premium: ["Centrum", "Rybáře"],
      stable: ["Tuhnice", "Dražovice", "Stará Role"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 55000, high: 75000 },
      panel_renovated: { low: 70000, high: 100000 },
      brick_needs_renov: { low: 65000, high: 90000 },
      brick_renovated: { low: 90000, high: 150000 },
    },
  },

  mariansk_lazne: {
    districts: {
      premium: ["Centrum", "Kolonáda"],
      stable: ["Úšovice"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 55000, high: 75000 },
      panel_renovated: { low: 70000, high: 100000 },
      brick_needs_renov: { low: 65000, high: 90000 },
      brick_renovated: { low: 90000, high: 150000 },
    },
  },

  zlin: {
    districts: {
      premium: ["Centrum", "Letná"],
      stable: ["Zálešná", "Prštné"],
      risky: [],
    },
    segments: {
      panel_needs_renov: { low: 30000, high: 45000 },
      panel_renovated: { low: 45000, high: 65000 },
      brick_needs_renov: { low: 35000, high: 50000 },
      brick_renovated: { low: 50000, high: 75000 },
    },
  },

  kladno: {
    districts: { premium: ["Centrum", "Kročehlavy"], stable: ["Rozdělov", "Švermov"], risky: ["Dubí", "Sítná"] },
    segments: { panel_needs_renov: { low: 25000, high: 38000 }, panel_renovated: { low: 35000, high: 50000 }, brick_needs_renov: { low: 30000, high: 42000 }, brick_renovated: { low: 42000, high: 60000 } },
  },
  mlada_boleslav: {
    districts: { premium: ["Centrum"], stable: ["Mladá Boleslav II", "Podlázky"], risky: [] },
    segments: { panel_needs_renov: { low: 28000, high: 40000 }, panel_renovated: { low: 38000, high: 55000 }, brick_needs_renov: { low: 32000, high: 45000 }, brick_renovated: { low: 45000, high: 65000 } },
  },
  kolin: {
    districts: { premium: ["Centrum", "Zálabí"], stable: ["Heřmanův Městec", "Kmochův ostrov"], risky: [] },
    segments: { panel_needs_renov: { low: 25000, high: 35000 }, panel_renovated: { low: 35000, high: 50000 }, brick_needs_renov: { low: 28000, high: 40000 }, brick_renovated: { low: 40000, high: 55000 } },
  },
  jihlava: {
    districts: { premium: ["Centrum"], stable: ["Horní Kosov", "Pávov"], risky: [] },
    segments: { panel_needs_renov: { low: 30000, high: 42000 }, panel_renovated: { low: 40000, high: 55000 }, brick_needs_renov: { low: 35000, high: 48000 }, brick_renovated: { low: 48000, high: 65000 } },
  },
  karvina: {
    districts: { premium: [], stable: ["Mizerov", "Ráj"], risky: ["Fryštát", "Hranice"] },
    segments: { panel_needs_renov: { low: 15000, high: 25000 }, panel_renovated: { low: 22000, high: 35000 }, brick_needs_renov: { low: 18000, high: 28000 }, brick_renovated: { low: 28000, high: 40000 } },
  },
  havirov: {
    districts: { premium: [], stable: ["Město", "Podlesí"], risky: ["Šumbark", "Prostřední Suchá"] },
    segments: { panel_needs_renov: { low: 18000, high: 28000 }, panel_renovated: { low: 25000, high: 38000 }, brick_needs_renov: { low: 20000, high: 30000 }, brick_renovated: { low: 30000, high: 45000 } },
  },
};

export const RISKY_CITIES = [
  "Most", "Chomutov", "Karviná", "Havířov", "Bruntál",
  "Krnov", "Jeseník", "Litvínov", "Osek", "Jirkov",
];

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
