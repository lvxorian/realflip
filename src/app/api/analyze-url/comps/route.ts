import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, propertyAnalysis } from "@/db/schema";
import { eq, and, ne, gte } from "drizzle-orm";
import { filterImages } from "@/lib/scraping/types";
import { CITY_ALIASES } from "@/lib/analysis/location";

function buildCityNames(cityKey: string): string[] {
  const names: string[] = [];
  const key = cityKey.toLowerCase().replace(/[_\-]/g, " ");
  names.push(key);
  // Collect all alias keys that map to this city key
  for (const [alias, normalized] of Object.entries(CITY_ALIASES)) {
    if (normalized === key.replace(/\s/g, "_")) {
      names.push(alias);
    }
  }
  // Also add raw geocoding names that users might type
  if (key === "praha") names.push("prague");
  if (key === "plzen") names.push("plzeň");
  if (key === "ceske budejovice") { names.push("české budějovice"); names.push("budejovice"); }
  if (key === "karlovy vary") names.push("karlovy vary");
  if (key === "usti") { names.push("ústí nad labem"); names.push("usti nad labem"); }
  if (key === "hradec") names.push("hradec králové");
  if (key === "zlin") names.push("zlín");
  if (key === "decin") names.push("děčín");
  if (key === "prerov") names.push("přerov");
  if (key === "breclav") names.push("břeclav");
  if (key === "kromeriz") names.push("kroměříž");
  if (key === "trebic") names.push("třebíč");
  if (key === "benesov") names.push("benešov");
  if (key === "havirov") names.push("havířov");
  return [...new Set(names)];
}

function addressMatchesCity(address: string | null, cityNames: string[]): boolean {
  if (!address) return false;
  const addr = address.toLowerCase();
  return cityNames.some((name) => addr.includes(name));
}

async function verifyUrls(comps: any[]): Promise<{ alive: any[]; dead: any[] }> {
  const results = await Promise.allSettled(
    comps.map(async (comp, i) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(comp.url, {
          method: "HEAD",
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        clearTimeout(timeout);
        return { comp, alive: res.ok };
      } catch {
        return { comp, alive: true };
      }
    })
  );
  
  const alive: any[] = [];
  const dead: any[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value.alive) alive.push(r.value.comp);
      else dead.push(r.value.comp);
    }
  }
  return { alive, dead };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { area, address, price, excludeUrl, city } = await req.json();

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: properties.id,
        title: properties.title,
        price: properties.price,
        area: properties.area,
        rooms: properties.rooms,
        address: properties.address,
        imageUrls: properties.imageUrls,
        url: properties.url,
        condition: properties.condition,
        buildingType: properties.buildingType,
        lat: properties.lat,
        lng: properties.lng,
        analysisScore: propertyAnalysis.investmentScore,
        analysisArv: propertyAnalysis.arv,
      })
      .from(properties)
      .leftJoin(propertyAnalysis, eq(properties.id, propertyAnalysis.propertyId))
      .where(and(
        eq(properties.isActive, 1),
        ne(properties.url, excludeUrl ?? ""),
        gte(properties.lastSeen, fourteenDaysAgo),
      ))
      .limit(50);

    let comps = rows;

    // 1) Filter by city using CITY_ALIASES
    if (city) {
      const cityNames = buildCityNames(city);
      const byCity = comps.filter((p) => addressMatchesCity(p.address, cityNames));
      if (byCity.length >= 2) comps = byCity;
      else comps = [];
    }

    if (comps.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { count: 0, medianPrice: 0, medianPricePerSqm: 0, p25: 0, p75: 0, min: 0, max: 0 },
        comps: [],
        note: city
          ? `Pro lokalitu "${city}" není v databázi dost recentních inzerátů. Čím víc budete scrapovat, tím přesnější srovnání bude.`
          : "Není k dispozici dost dat pro srovnání.",
      });
    }

    // 2) Filter by area ±30 %
    if (area && area > 0 && comps.length > 2) {
      const areaRange = area * 0.3;
      const byArea = comps.filter(
        (p) => p.area && Math.abs(p.area - area) <= areaRange
      );
      if (byArea.length >= 2) comps = byArea;
    }

    // 3) Filter by price ±50 %
    if (price && comps.length > 2) {
      const priceMin = price * 0.5;
      const priceMax = price * 2;
      const byPrice = comps.filter(
        (p) => p.price >= priceMin && p.price <= priceMax
      );
      if (byPrice.length >= 2) comps = byPrice;
    }

    // Verify URLs in parallel
    const { alive, dead } = await verifyUrls(comps);
    if (alive.length >= 2) comps = alive;
    else if (dead.length > 0) { /* keep originals if too few alive */ }

    // Stats
    const prices = comps.map((p) => p.price).filter((p): p is number => p > 0);
    const areas = comps.map((p) => p.area).filter((a): a is number => a !== null && a > 0);
    const pricePerSqms = prices
      .map((p, i) => (areas[i] ? Math.round(p / areas[i]) : null))
      .filter((p): p is number => p !== null);

    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    const p25 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.25)] : 0;
    const p75 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.75)] : 0;

    const sortedPerSqm = [...pricePerSqms].sort((a, b) => a - b);
    const medianPerSqm = sortedPerSqm.length > 0
      ? sortedPerSqm.length % 2 === 0
        ? (sortedPerSqm[sortedPerSqm.length / 2 - 1] + sortedPerSqm[sortedPerSqm.length / 2]) / 2
        : sortedPerSqm[Math.floor(sortedPerSqm.length / 2)]
      : 0;

    const mappedComps = comps.slice(0, 20).map((p) => {
      let imageUrl: string | null = null;
      if (p.imageUrls) {
        try {
          const parsed = JSON.parse(p.imageUrls as string);
          const filtered = filterImages(Array.isArray(parsed) ? parsed : []);
          imageUrl = filtered[0] ?? null;
        } catch { imageUrl = null; }
      }
      return {
        id: p.id,
        title: p.title,
        price: p.price,
        area: p.area,
        rooms: p.rooms,
        address: p.address,
        condition: p.condition,
        buildingType: p.buildingType,
        imageUrl,
        url: p.url,
        score: p.analysisScore,
        arv: p.analysisArv,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        count: comps.length,
        medianPrice: Math.round(median),
        medianPricePerSqm: Math.round(medianPerSqm),
        p25: Math.round(p25),
        p75: Math.round(p75),
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      },
      comps: mappedComps,
      deadCount: dead.length,
    });
  } catch (error) {
    console.error("Comps API error:", error);
    return NextResponse.json(
      { success: false, error: "Nepodařilo se načíst srovnatelné nemovitosti" },
      { status: 500 }
    );
  }
}
