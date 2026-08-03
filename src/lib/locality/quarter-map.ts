/**
 * Mapování názvů městských částí (z Nominatim reverse-geocode) na sreality quarter_id.
 * Slouží jako fallback pro nemovitosti mimo sreality — geokódujeme adresu → GPS →
 * Nominatim vrací čtvrť → přiřadíme sreality quarter_id → POI per čtvrť.
 *
 * Názvy čtvrtí jsou jak je vrací Nominatim (česky, např. "Praha 3", "Plzeň 3").
 * quarter_id je ID městské části v sreality číselníku.
 */

export interface QuarterEntry {
  /** Normalizovaný název pro matchování (bez diakritiky, lowercase). */
  names: string[];
  cityKey: string;
  quarterId: number;
  label: string;
  /** district_id okresu v sreality (nutný pro POI filtr). */
  districtId: number | null;
}

const PRAHA_D1 = 5001; // Praha 1
const PRAHA_D2 = 5002; // Praha 2
const PRAHA_D3 = 5003; // Praha 3
const PRAHA_D4 = 5004; // Praha 4, 11, 12
const PRAHA_D5 = 5005; // Praha 5, 13, 16
const PRAHA_D6 = 5006; // Praha 6, 17
const PRAHA_D7 = 5007; // Praha 7
const PRAHA_D8 = 5008; // Praha 8
const PRAHA_D9 = 5009; // Praha 9, 14, 18, 19, 20
const PRAHA_D10 = 5010; // Praha 10, 15, 21, 22
const BRNO_DISTRICT = 72;
const PLZEN_DISTRICT = 12;
const OSTRAVA_DISTRICT = 65;
const USTI_DISTRICT = 27;
const OLOMOUC_DISTRICT = 42;
const KARLOVY_VARY_DISTRICT = 10;
const CHEB_DISTRICT = 9;
const LIBEREC_DISTRICT = 22;
const PARDUBICE_DISTRICT = 32;
const HRADEC_DISTRICT = 28;
const ZLIN_DISTRICT = 38;
const JIHLAVA_DISTRICT = 67;
const BUDEJOVICE_DISTRICT = 1;

const QUARTERS: QuarterEntry[] = [
  // Praha — obvody (district_id = správní obvod, sdružuje více městských částí)
  { names: ["praha 1", "stare mesto", "nové město", "nove mesto"], cityKey: "praha", quarterId: 112, label: "Praha 1", districtId: PRAHA_D1 },
  { names: ["praha 2", "vinohrady", "nusle"], cityKey: "praha", quarterId: 113, label: "Praha 2", districtId: PRAHA_D2 },
  { names: ["praha 3", "zizkov", "žižkov"], cityKey: "praha", quarterId: 114, label: "Praha 3", districtId: PRAHA_D3 },
  { names: ["praha 4", "braník", "krc", "krč", "podolí", "michele", "chodov", "sporilov", "spořilov", "lhotka", "kamyk", "kamýk"], cityKey: "praha", quarterId: 115, label: "Praha 4", districtId: PRAHA_D4 },
  { names: ["praha 5", "smíchov", "smichov", "kosin", "košíř", "motol", "radejín", "radotín", "zvonarín", "zvonářín", "jinonice", "hřebenky", "hrebenky"], cityKey: "praha", quarterId: 116, label: "Praha 5", districtId: PRAHA_D5 },
  { names: ["praha 6", "dejvice", "bubenec", "bubeneč", "stresovice", "střešovice", "veletržní", "sedlec", "suchdol", "lysolaje", "vokovice", "veleslavín", "veleslavin"], cityKey: "praha", quarterId: 117, label: "Praha 6", districtId: PRAHA_D6 },
  { names: ["praha 7", "holešovice", "holesovice", "letná", "letna", "bubny"], cityKey: "praha", quarterId: 118, label: "Praha 7", districtId: PRAHA_D7 },
  { names: ["praha 8", "karlín", "karlin", "liben", "kobylisy", "čimice", "cimice", "bohnice", "dolní chabry"], cityKey: "praha", quarterId: 119, label: "Praha 8", districtId: PRAHA_D8 },
  { names: ["praha 9", "strizkov", "střížkov", "prosek", "černý most", "cerny most", "vysočany", "vysocany", "harden", "kbel", "horní počernice", "horni pocernice", "letnany", "letňany"], cityKey: "praha", quarterId: 119, label: "Praha 9", districtId: PRAHA_D9 },
  { names: ["praha 10", "vrsovice", "vršovice", "strasnice", "strašnice", "malešice", "malesice", "zabehlice", "záběhlice", "hostivař", "hostivar"], cityKey: "praha", quarterId: 120, label: "Praha 10", districtId: PRAHA_D10 },
  { names: ["praha 11", "jizni mesto", "jižní město", "chodec", "haje", "háje"], cityKey: "praha", quarterId: 121, label: "Praha 11", districtId: PRAHA_D4 },
  { names: ["praha 12", "modrany", "modřany", "komorany", "komořany", "pisnice", "písnice"], cityKey: "praha", quarterId: 122, label: "Praha 12", districtId: PRAHA_D4 },
  { names: ["praha 13", "stodulky", "lužiny", "luziny", "jinonice", "reporyje", "řeporyje", "třebonice", "trebonice"], cityKey: "praha", quarterId: 123, label: "Praha 13", districtId: PRAHA_D5 },
  { names: ["praha 14", "cerny most", "černý most", "hlaubetin", "kyje", "dolni pocernice", "dolní počernice"], cityKey: "praha", quarterId: 124, label: "Praha 14", districtId: PRAHA_D9 },
  { names: ["praha 15", "horni mečolupy", "horní měcholupy", "petrovice", "hostivar", "hostivař"], cityKey: "praha", quarterId: 125, label: "Praha 15", districtId: PRAHA_D10 },
  { names: ["praha 16", "radotin", "radotín"], cityKey: "praha", quarterId: 126, label: "Praha 16", districtId: PRAHA_D5 },
  { names: ["praha 17", "repy", "řepy", "zlicin", "zlíčín"], cityKey: "praha", quarterId: 127, label: "Praha 17", districtId: PRAHA_D6 },
  { names: ["praha 18", "letnany", "letňany", "čakovice", "cakovice"], cityKey: "praha", quarterId: 128, label: "Praha 18", districtId: PRAHA_D9 },
  { names: ["praha 19", "kbel", "satalice", "vinoř", "vinor"], cityKey: "praha", quarterId: 129, label: "Praha 19", districtId: PRAHA_D9 },
  { names: ["praha 20", "horni pocernice", "horní počernice"], cityKey: "praha", quarterId: 130, label: "Praha 20", districtId: PRAHA_D9 },
  { names: ["praha 21", "ujezd nad lesy", "újezd nad lesy"], cityKey: "praha", quarterId: 131, label: "Praha 21", districtId: PRAHA_D9 },
  { names: ["praha 22", "uhříněves", "uhrineves", "křeslice", "kreslice"], cityKey: "praha", quarterId: 132, label: "Praha 22", districtId: PRAHA_D10 },

  // Brno — městské části
  { names: ["brno-střed", "brno-stred", "brno město", "brno mesto", "veverí", "veveří", "staré brno", "stare brno", "trnitá", "trnita"], cityKey: "brno", quarterId: 180, label: "Brno-střed", districtId: BRNO_DISTRICT },
  { names: ["brno-žabovřesky", "brno-zabovresky", "žabovřesky", "zabovresky"], cityKey: "brno", quarterId: 181, label: "Brno-Žabovřesky", districtId: BRNO_DISTRICT },
  { names: ["brno-královo pole", "brno-kralovo pole", "královo pole", "kralovo pole", "ponava"], cityKey: "brno", quarterId: 182, label: "Brno-Královo Pole", districtId: BRNO_DISTRICT },
  { names: ["brno-sever", "brno-černá pole", "brno-cerna pole", "černá pole", "cerna pole", "zábrdovice", "zabrdovice", "husovice"], cityKey: "brno", quarterId: 183, label: "Brno-sever", districtId: BRNO_DISTRICT },
  { names: ["brno-vinohrady", "lesná", "lesna"], cityKey: "brno", quarterId: 184, label: "Brno-Vinohrady", districtId: BRNO_DISTRICT },
  { names: ["brno-žíšina", "brno-zizina"], cityKey: "brno", quarterId: 185, label: "Brno-Žíšina", districtId: BRNO_DISTRICT },
  { names: ["brno-jih", "brno-černovice", "brno-cernovice", "komárov", "komarov"], cityKey: "brno", quarterId: 186, label: "Brno-jih", districtId: BRNO_DISTRICT },
  { names: ["brno-bohunice", "bohunice"], cityKey: "brno", quarterId: 187, label: "Brno-Bohunice", districtId: BRNO_DISTRICT },
  { names: ["brno-líšeň", "brno-lisen", "líšeň", "lisen"], cityKey: "brno", quarterId: 188, label: "Brno-Líšeň", districtId: BRNO_DISTRICT },
  { names: ["brno-bystrc", "bystrc", "kníničky", "kninicky"], cityKey: "brno", quarterId: 189, label: "Brno-Bystrc", districtId: BRNO_DISTRICT },

  // Plzeň — obvody
  { names: ["plzeň 1", "plzen 1", "plzeň-sever", "plzen-sever", "bolevec", "severní předměstí", "severni predmesti", "lochotín", "lochotin"], cityKey: "plzen", quarterId: 5, label: "Plzeň 1", districtId: PLZEN_DISTRICT },
  { names: ["plzeň 2", "plzen 2", "slovany", "božkov", "bozkov", "hradiště", "hradiste"], cityKey: "plzen", quarterId: 7, label: "Plzeň 2", districtId: PLZEN_DISTRICT },
  { names: ["plzeň 3", "plzen 3", "jižní předměstí", "jizni predmesti", "východní předměstí", "vychodni predmesti", "centrum", "bory", "černice", "cernice", "doudlevce", "radčice", "radcice"], cityKey: "plzen", quarterId: 6, label: "Plzeň 3", districtId: PLZEN_DISTRICT },
  { names: ["plzeň 4", "plzen 4", "doubravka", "újezd", "ujezd", "bukovec"], cityKey: "plzen", quarterId: 8, label: "Plzeň 4", districtId: PLZEN_DISTRICT },
  { names: ["plzeň 5", "plzen 5", "košutka", "kosutka", "křimice", "krimice"], cityKey: "plzen", quarterId: 9, label: "Plzeň 5", districtId: PLZEN_DISTRICT },
  { names: ["plzeň 6", "plzen 6", "litice", "útušice", "utusice"], cityKey: "plzen", quarterId: 10, label: "Plzeň 6", districtId: PLZEN_DISTRICT },
  { names: ["plzeň 7", "plzen 7", "radčice", "radcice"], cityKey: "plzen", quarterId: 11, label: "Plzeň 7", districtId: PLZEN_DISTRICT },

  // Ostrava — obvody
  { names: ["ostrava", "moravská ostrava", "moravska ostrava", "přívoz", "privoz", "mariánské hory", "marianske hory"], cityKey: "ostrava", quarterId: 200, label: "Ostrava", districtId: OSTRAVA_DISTRICT },
  { names: ["ostrava-jih", "ostrava jih", "hrabůvka", "hrabuvka", "zabřeh", "zabreh", "výškovice", "vyskovice", "kovartiny"], cityKey: "ostrava", quarterId: 201, label: "Ostrava-Jih", districtId: OSTRAVA_DISTRICT },
  { names: ["poruba", "svinov", "třebovice", "trebovice"], cityKey: "ostrava", quarterId: 202, label: "Ostrava-Poruba", districtId: OSTRAVA_DISTRICT },
  { names: ["vítkovice", "vitkovice", "hrušov", "hrusov"], cityKey: "ostrava", quarterId: 203, label: "Ostrava-Vítkovice", districtId: OSTRAVA_DISTRICT },

  // Ústí nad Labem — centrum
  { names: ["ústí nad labem", "usti nad labem", "ústí", "usti"], cityKey: "usti", quarterId: 210, label: "Ústí nad Labem", districtId: USTI_DISTRICT },

  // Olomouc — centrum
  { names: ["olomouc", "nová ulice", "nova ulice", "nové sady", "nove sady", "lazce", "hodolany"], cityKey: "olomouc", quarterId: 220, label: "Olomouc", districtId: OLOMOUC_DISTRICT },

  // Karlovy Vary — centrum
  { names: ["karlovy vary", "karlovy-vary"], cityKey: "karlovy_vary", quarterId: 230, label: "Karlovy Vary", districtId: KARLOVY_VARY_DISTRICT },

  // Cheb — centrum
  { names: ["cheb"], cityKey: "cheb", quarterId: 240, label: "Cheb", districtId: CHEB_DISTRICT },

  // Liberec — centrum
  { names: ["liberec", "vratislavice", "vratislavice nad nisou"], cityKey: "liberec", quarterId: 250, label: "Liberec", districtId: LIBEREC_DISTRICT },

  // Pardubice — centrum
  { names: ["pardubice", "pardubice i", "zelené předměstí", "zelene predmesti"], cityKey: "pardubice", quarterId: 251, label: "Pardubice", districtId: PARDUBICE_DISTRICT },

  // Hradec Králové — centrum
  { names: ["hradec králové", "hradec kralove", "hradec"], cityKey: "hradec", quarterId: 252, label: "Hradec Králové", districtId: HRADEC_DISTRICT },

  // Zlín — centrum
  { names: ["zlín", "zlin"], cityKey: "zlin", quarterId: 253, label: "Zlín", districtId: ZLIN_DISTRICT },

  // Jihlava — centrum
  { names: ["jihlava"], cityKey: "jihlava", quarterId: 254, label: "Jihlava", districtId: JIHLAVA_DISTRICT },

  // České Budějovice — centrum
  { names: ["české budějovice", "ceske budejovice", "budejovice"], cityKey: "ceske_budejovice", quarterId: 255, label: "České Budějovice", districtId: BUDEJOVICE_DISTRICT },
];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[–\-—]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Přiřadí název městské části (z Nominatim) k sreality quarter_id.
 * Vrací { quarterId, cityKey, label } nebo null.
 */
export function matchQuarterToSreality(quarterName: string | null | undefined, cityKey: string | null): QuarterEntry | null {
  if (!quarterName) return null;
  const n = normalize(quarterName);
  if (!n) return null;

  const candidates = cityKey
    ? QUARTERS.filter((q) => q.cityKey === cityKey)
    : QUARTERS;

  // Přesná shoda názvu
  for (const q of candidates) {
    if (q.names.map(normalize).includes(n)) return q;
  }
  // Částečná shoda (název obsahuje čtvrť, nebo čtvrť obsahuje název)
  for (const q of candidates) {
    if (q.names.some((name) => normalize(name).includes(n) || n.includes(normalize(name)))) return q;
  }
  return null;
}
