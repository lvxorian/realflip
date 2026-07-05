import { db, schema } from "../src/db";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

const day = 86400000;
const { users, userPreferences, properties, propertyAnalysis, leads, contacts } = schema as any;

function dt(offset = 0) {
  return new Date(Date.now() - offset);
}

function generateId() {
  return crypto.randomUUID();
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
  console.log("Seeding database...\n");

  const userId = "user-cakmak-001";

  const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((r: any[]) => r[0]);

  if (!existing) {
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
      minScore: 40,
      propertyTypes: JSON.stringify(["Byt", "Rodinny dum"]),
      createdAt: dt(),
      updatedAt: dt(),
    });

    console.log("User created: cakmak@tuta.com / realflip2026\n");
  } else {
    console.log("User already exists, skipping\n");
  }

  const propertyData = [
    { id: "prop-001", title: "Byt 3+kk, Praha 8 - Karlin", portal: "sreality", price: 4890000, area: 50, rooms: "3+kk", address: "Sokolovska 123, Praha 8", lat: 50.092, lng: 14.455, condition: "puvodni", desc: "Byt v osobnim vlastnictvi v cihlovem dome v KARLINE.", score: 82, mv: 5850000 },
    { id: "prop-002", title: "Rodinny dum, Brno - Kralovo Pole", portal: "bezrealitky", price: 7250000, area: 100, rooms: "4+1", address: "Bozetechova 45, Brno", lat: 49.227, lng: 16.596, condition: "dobry", desc: "Rodinny dum.", score: 74, mv: 8100000 },
    { id: "prop-003", title: "Byt 2+kk, Ostrava - Poruba", portal: "sreality", price: 2890000, area: 45, rooms: "2+kk", address: "Hlavni trida 789, Ostrava", lat: 49.820, lng: 18.178, condition: "po rekonstrukci", desc: "Po kompletni rekonstrukci.", score: 91, mv: 3850000 },
    { id: "prop-004", title: "Cinzovni dum, Praha 3 - Zizkov", portal: "remax", price: 12500000, area: 240, rooms: "6+2", address: "Jeseninova 22, Praha 3", lat: 50.084, lng: 14.456, condition: "puvodni", desc: "Cinzovni dum.", score: 45, mv: 14200000 },
    { id: "prop-005", title: "Byt 1+kk, Praha 5 - Smichov", portal: "century21", price: 3450000, area: 30, rooms: "1+kk", address: "Radlicka 55, Praha 5", lat: 50.072, lng: 14.398, condition: "dobry", desc: "Malý byt.", score: 68, mv: 3950000 },
  ];

  let seeded = 0;
  for (const p of propertyData) {
    const exists = await db.select().from(properties).where(eq(properties.id, p.id)).limit(1).then((r: any[]) => r[0]);
    if (exists) continue;

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

    const reno = Math.round(p.area * (p.condition === "puvodni" ? 12000 : 8000));
    const total = p.price + reno + Math.round(p.price * 0.12);
    const arv = Math.round(p.mv * 1.1);
    const profit = arv - total;
    const roi = total > 0 ? (profit / total) * 100 : 0;

    await db.insert(propertyAnalysis).values({
      id: generateId(),
      propertyId: p.id,
      marketValue: p.mv,
      undervaluationPct: Math.round(((p.mv - p.price) / p.mv) * 100 * 10) / 10,
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

    seeded++;
  }

  console.log(`Properties seeded: ${seeded}`);

  const contactData = [
    { id: "c001", name: "Jan Novak", phone: "+420 777 123 456", email: "jan.novak@reality.cz", type: "agent", tags: JSON.stringify(["RE/MAX", "Praha"]) },
    { id: "c002", name: "Marie Dvorakova", phone: "+420 731 456 789", email: "marie@century21.cz", type: "agent", tags: JSON.stringify(["Century21", "Brno"]) },
  ];

  for (const c of contactData) {
    const exists = await db.select().from(contacts).where(eq(contacts.id, c.id)).limit(1).then((r: any[]) => r[0]);
    if (!exists) {
      await db.insert(contacts).values({ ...c, createdAt: dt(), updatedAt: dt() });
    }
  }
  console.log(`Contacts seeded: ${contactData.length}`);

  console.log("\nSeed complete! Login: cakmak@tuta.com / realflip2026");
}

seed().catch((e) => { console.error(e); process.exit(1); });
