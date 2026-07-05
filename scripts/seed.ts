import { db } from "../src/db";
import {
  users,
  userPreferences,
  properties,
  priceHistory,
  propertyAnalysis,
  leads,
  contacts,
  activityLog,
  marketData,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "../src/lib/utils";
import { hash } from "bcryptjs";

const day = 86400000;

function dt(offset = 0) {
  return new Date(Date.now() - offset);
}

function portalUrl(portal: string, id: string): string {
  const map: Record<string, string> = {
    sreality: `https://www.sreality.cz/detail/prodej/byt/${id}`,
    bezrealitky: `https://www.bezrealitky.cz/nemovitosti-byty-domy/${id}`,
    bazos: `https://reality.bazos.cz/predam/byt/${id}.html`,
    remax: `https://www.remax.cz/nemovitosti/${id}`,
    century21: `https://www.century21.cz/nemovitost/${id}`,
    "reality-cz": `https://www.reality.cz/nemovitost/${id}`,
    "idnes-reality": `https://reality.idnes.cz/nemovitost/${id}`,
    hyperreality: `https://www.hyperreality.cz/nemovitost/${id}`,
    mmreality: `https://www.mmreality.cz/nemovitost/${id}`,
    annonce: `https://www.annonce.cz/reality/${id}`,
  };
  return map[portal] || `https://example.com/${portal}/${id}`;
}

function imageUrls(id: string, count = 5): string {
  return JSON.stringify(
    Array.from({ length: count }, (_, i) => `https://picsum.photos/seed/${id}-${i + 1}/1200/800`)
  );
}

async function seed() {
  console.log("Seeding database...");

  const userId = "user-cakmak-001";
  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (existing.length === 0) {
    const passwordHash = await hash("realflip2026", 12);
    await db.insert(users).values({
      id: userId,
      name: "Cakmak",
      email: "cakmak@tuta.com",
      passwordHash,
      onboardingCompleted: true,
      role: "user",
      createdAt: dt(),
      updatedAt: dt(),
    });

    await db.insert(userPreferences).values({
      id: generateId(),
      userId,
      targetLocalities: JSON.stringify(["Praha", "Brno", "Ostrava"]),
      budgetMin: 2000000,
      budgetMax: 15000000,
      minRoi: 15,
      propertyTypes: JSON.stringify(["Byt", "Rodinny dum"]),
      createdAt: dt(),
      updatedAt: dt(),
    });

    console.log("User created (cakmak@tuta.com / realflip2026)");
  } else {
    console.log("User already exists, skipping");
  }

  const propertyData = [
    { id: "prop-001", title: "Byt 3+kk, Praha 8 - Karlin", portal: "sreality", price: 4890000, area: 50, rooms: "3+kk", address: "Sokolovska 123, Praha 8", lat: 50.092, lng: 14.455, condition: "puvodni", desc: "Byt v osobnim vlastnictvi v cihlovem dome v KARLINE. Puvodni stav, nutna rekonstrukce.", score: 82, mv: 5850000 },
    { id: "prop-002", title: "Rodinny dum, Brno - Kralovo Pole", portal: "bezrealitky", price: 7250000, area: 100, rooms: "4+1", address: "Bozetechova 45, Brno", lat: 49.227, lng: 16.596, condition: "dobry", desc: "Rodinny dum v klidne lokalite. Castecne renovovany.", score: 74, mv: 8100000 },
    { id: "prop-003", title: "Byt 2+kk, Ostrava - Poruba", portal: "sreality", price: 2890000, area: 45, rooms: "2+kk", address: "Hlavni trida 789, Ostrava", lat: 49.820, lng: 18.178, condition: "po rekonstrukci", desc: "Po kompletni rekonstrukci v roce 2024. Nova kuchyn, koupelna.", score: 91, mv: 3850000 },
    { id: "prop-004", title: "Cinzovni dum, Praha 3 - Zizkov", portal: "remax", price: 12500000, area: 240, rooms: "6+2", address: "Jeseninova 22, Praha 3", lat: 50.084, lng: 14.456, condition: "puvodni", desc: "Cinzovni dum v centru Zizkova. 6 bytovych jednotek.", score: 45, mv: 14200000 },
    { id: "prop-005", title: "Byt 1+kk, Praha 5 - Smichov", portal: "century21", price: 3450000, area: 30, rooms: "1+kk", address: "Radlicka 55, Praha 5", lat: 50.072, lng: 14.398, condition: "dobry", desc: "Malý byt v dobre stavu v centru SMICHOVA.", score: 68, mv: 3950000 },
    { id: "prop-006", title: "Byt 2+1, Praha 4 - Nusle", portal: "sreality", price: 4200000, area: 50, rooms: "2+1", address: "TABORSKA 234, Praha 4", lat: 50.056, lng: 14.437, condition: "puvodni", desc: "Byt v Nuslich v puvodnim stavu. Nutna rekonstrukce.", score: 56, mv: 4650000 },
    { id: "prop-007", title: "Byt 3+1, Brno - Styrice", portal: "bezrealitky", price: 5900000, area: 68, rooms: "3+1", address: "VIDENSKA 67, Brno", lat: 49.177, lng: 16.597, condition: "dobry", desc: "Prostorny byt v Brne-STYRICICH. Castecne renovovany.", score: 71, mv: 6700000 },
    { id: "prop-008", title: "Rodinny dum, Liberec - Vratislavice", portal: "reality-cz", price: 4980000, area: 95, rooms: "3+1", address: "U Skaly 12, Liberec", lat: 50.776, lng: 15.056, condition: "puvodni", desc: "Rodinny dum v Liberci. Nutna rekonstrukce.", score: 78, mv: 5850000 },
    { id: "prop-009", title: "Byt 2+kk, Plzen - Bory", portal: "sreality", price: 3650000, area: 42, rooms: "2+kk", address: "Borska 34, Plzen", lat: 49.724, lng: 13.374, condition: "puvodni", desc: "Byt v Plzni na Borech. Puvodni stav.", score: 63, mv: 4100000 },
    { id: "prop-010", title: "Byt 1+1, Praha 10 - Vrsovice", portal: "annonce", price: 2950000, area: 28, rooms: "1+1", address: "Krymska 78, Praha 10", lat: 50.063, lng: 14.468, condition: "puvodni", desc: "Maly byt ve Vrsovicich. Idealni pro prvni investici.", score: 52, mv: 3250000 },
    { id: "prop-011", title: "Byt 3+kk, Praha 6 - Dejvice", portal: "sreality", price: 7200000, area: 65, rooms: "3+kk", address: "Zelena 15, Praha 6", lat: 50.103, lng: 14.393, condition: "dobry", desc: "Byt v prestizni lokalite Dejvic. Dobry stav.", score: 59, mv: 7800000 },
    { id: "prop-012", title: "Rodinny dum, Olomouc - Hejcin", portal: "idnes-reality", price: 5800000, area: 110, rooms: "4+1", address: "Kastanova 8, Olomouc", lat: 49.602, lng: 17.246, condition: "po rekonstrukci", desc: "Zrekonstruovany dum v Olomouci.", score: 75, mv: 6500000 },
    { id: "prop-013", title: "Byt 2+1, Ceske Budejovice", portal: "hyperreality", price: 3900000, area: 55, rooms: "2+1", address: "Prazska 190, CB", lat: 48.974, lng: 14.470, condition: "dobry", desc: "Byt v Ceskych Budejovicich. Dobry stav.", score: 66, mv: 4300000 },
    { id: "prop-014", title: "Byt 1+kk, Brno - Veveři", portal: "mmreality", price: 3100000, area: 32, rooms: "1+kk", address: "Lipova 12, Brno", lat: 49.206, lng: 16.595, condition: "puvodni", desc: "Maly byt v Brne-Veveri.", score: 70, mv: 3700000 },
    { id: "prop-015", title: "Cinzovni dum, Brno - Zabrdovice", portal: "remax", price: 15800000, area: 300, rooms: "8+3", address: "Cejl 56, Brno", lat: 49.193, lng: 16.621, condition: "puvodni", desc: "Velky cinzovni dum v Brne.", score: 38, mv: 14800000 },
  ];

  for (const p of propertyData) {
    const existing = await db.select().from(properties).where(eq(properties.id, p.id)).limit(1);
    if (existing.length > 0) continue;

    await db.insert(properties).values({
      id: p.id,
      portalId: `${p.portal}_${p.id}`,
      portalName: p.portal,
      url: portalUrl(p.portal, p.id),
      title: p.title,
      price: p.price,
      pricePerSqm: Math.round(p.price / p.area),
      area: p.area,
      rooms: p.rooms,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      condition: p.condition,
      description: p.desc,
      imageUrls: imageUrls(p.id),
      status: "active",
      isActive: true,
      firstSeen: dt(30 * day),
      lastSeen: dt(),
    });

    await db.insert(priceHistory).values({
      id: generateId(),
      propertyId: p.id,
      price: Math.round(p.price * 1.15),
      recordedAt: dt(30 * day),
    });
    await db.insert(priceHistory).values({
      id: generateId(),
      propertyId: p.id,
      price: p.price,
      recordedAt: dt(5 * day),
    });

    const undervaluation = ((p.mv - p.price) / p.mv) * 100;
    const reno = Math.round(p.area * (p.condition === "puvodni" ? 12000 : p.condition === "dobry" ? 8000 : 4000));
    const total = p.price + reno + Math.round(p.price * 0.12);
    const arv = Math.round(p.mv * 1.1);
    const profit = arv - total;
    const roi = total > 0 ? (profit / total) * 100 : 0;

    await db.insert(propertyAnalysis).values({
      id: generateId(),
      propertyId: p.id,
      marketValue: p.mv,
      undervaluationPct: Math.round(undervaluation * 10) / 10,
      investmentScore: p.score,
      arv,
      renovationCost: reno,
      totalCost: total,
      netProfit: profit,
      roi: Math.round(roi * 10) / 10,
      annualizedRoi: Math.round(roi * 2 * 10) / 10,
      cashOnCash: Math.round((profit / p.price) * 100 * 10) / 10,
      breakEvenPrice: Math.round(p.price * 0.85),
      recommendation: p.score >= 70 ? "buy" : p.score >= 40 ? "consider" : "skip",
      createdAt: dt(),
      updatedAt: dt(),
    });
  }
  console.log(`Properties seeded: ${propertyData.length}`);

  const contactData = [
    { id: "c001", name: "Jan Novak", phone: "+420 777 123 456", email: "jan.novak@reality.cz", type: "agent", tags: JSON.stringify(["RE/MAX", "Praha"]) },
    { id: "c002", name: "Marie Dvorakova", phone: "+420 731 456 789", email: "marie@century21.cz", type: "agent", tags: JSON.stringify(["Century21", "Brno"]) },
    { id: "c003", name: "Petr Svoboda", phone: "+420 602 987 654", type: "owner", tags: JSON.stringify(["majitel", "Ostrava", "motivovany"]) },
    { id: "c004", name: "Tomas Cerny", phone: "+420 605 111 222", email: "cerny@seznam.cz", type: "owner", tags: JSON.stringify(["majitel", "Praha"]) },
  ];

  for (const c of contactData) {
    const existing = await db.select().from(contacts).where(eq(contacts.id, c.id)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(contacts).values({ ...c, createdAt: dt(), updatedAt: dt() });
  }
  console.log(`Contacts seeded: ${contactData.length}`);

  const leadData = [
    { id: "l001", propertyId: "prop-001", contactId: "c001", stage: "meeting", priority: 90 },
    { id: "l002", propertyId: "prop-003", contactId: "c003", stage: "contacted", priority: 85 },
    { id: "l003", propertyId: "prop-002", contactId: "c002", stage: "new", priority: 75 },
    { id: "l004", propertyId: "prop-005", contactId: "c004", stage: "negotiation", priority: 65 },
    { id: "l005", propertyId: "prop-007", contactId: "c002", stage: "new", priority: 70 },
  ];

  for (const l of leadData) {
    const existing = await db.select().from(leads).where(eq(leads.id, l.id)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(leads).values({ ...l, createdAt: dt(), updatedAt: dt() });
  }
  console.log(`Leads seeded: ${leadData.length}`);

  await db.insert(marketData).values({
    id: generateId(), locality: "Praha", date: dt(), avgPriceSqm: 105000, listingsCount: 450, avgDaysOnMarket: 22, createdAt: dt(),
  });
  await db.insert(marketData).values({
    id: generateId(), locality: "Brno", date: dt(), avgPriceSqm: 82000, listingsCount: 230, avgDaysOnMarket: 28, createdAt: dt(),
  });
  await db.insert(marketData).values({
    id: generateId(), locality: "Ostrava", date: dt(), avgPriceSqm: 45000, listingsCount: 120, avgDaysOnMarket: 35, createdAt: dt(),
  });

  const activities = [
    { type: "scraping", message: "Scraping sreality.cz dokoncen (47 inzeratu)" },
    { type: "new_property", message: "Nalezen novy inzerat - byt 2+kk, Praha 4" },
    { type: "price", message: "Snizeni ceny o 150 000 Kc - byt 3+kk, Brno" },
    { type: "lead", message: "Lead postoupen do faze Schuzka - Praha 8" },
    { type: "call", message: "Hovor s maklerem - domluvena prohlidka" },
  ];
  for (const a of activities) {
    await db.insert(activityLog).values({
      id: generateId(), type: a.type, message: a.message, createdAt: dt(Math.floor(Math.random() * day)),
    });
  }

  console.log("\nSeed complete!");
  console.log("Login: cakmak@tuta.com / realflip2026");
}

seed().catch((e) => { console.error(e); process.exit(1); });
