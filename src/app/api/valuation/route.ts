import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scrapeUrl } from "@/lib/scraping/url-scraper";
import { applyAreaResolution } from "@/lib/scraping/area-resolver";
import { isSaleListing } from "@/lib/scraping/filters";
import { classifyLocation } from "@/lib/analysis/location";
import { cityKeyToName, geocodeAddress, reverseGeocode } from "@/lib/geocode";
import { estimateProperty, attachTrend, scaleToDate } from "@/lib/valuation/engine";
import { fetchPriceMap } from "@/lib/valuation/price-map"; // trend grafu
import { correctValuation, explainValuation } from "@/lib/valuation/ai";
import type { ValuationInput } from "@/lib/valuation/types";

/**
 * Velká města s velkou likviditou trhu — realizované prodeje za posledních 6 měsíců
 * (jako Valuo) jsou relevantnější než 12M. Malá města potřebují 12M (málo transakcí).
 * Uživatel může okno přepsat polem lookbackMonths (6/12/24).
 */
const LIQUID_CITIES = new Set([
  "praha",
  "brno",
  "ostrava",
  "plzen",
  "olomouc",
  "hradec",
  "pardubice",
  "ceske_budejovice",
  "liberec",
  "zlin",
  "karlovy_vary",
  "kladno",
  "mlada_boleslav",
  "kolin",
  "jihlava",
  "usti",
]);

function inferType(rooms: string | null, buildingType: string | null, title: string | null): "flat" | "house" | "land" {
  const text = `${rooms ?? ""} ${buildingType ?? ""} ${title ?? ""}`.toLowerCase();
  if (/pozemk|parcela|land/i.test(text)) return "land";
  if (/d[uú]m|villa|chalupa|chata|house/i.test(text)) return "house";
  return "flat";
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const url: string | undefined = typeof body.url === "string" && body.url.trim() ? body.url.trim() : undefined;
    const fields: Partial<ValuationInput> | undefined =
      body.fields && typeof body.fields === "object" ? body.fields : undefined;

    // ---------- Fáze 1: URL → načti data inzerátu ----------
    let listingFields: Partial<ValuationInput> = {};
    if (url) {
      try {
        const { listing: rawListing } = await scrapeUrl(url);
        const { resolved: listing } = applyAreaResolution(rawListing);
        if (!isSaleListing(listing)) {
          return NextResponse.json(
            { error: "Tento inzerát není prodejní nabídkou (poptávky a nájmy nejsou podporovány)" },
            { status: 400 }
          );
        }
        if (!listing.price || listing.price <= 0) {
          return NextResponse.json({ error: "Nepodařilo se načíst cenu inzerátu" }, { status: 400 });
        }
        const location = classifyLocation(listing.address, listing.title);
        listingFields = {
          address: listing.address,
          cityKey: location.city !== "Neznámá" ? location.city : undefined,
          cityName: location.city !== "Neznámá" ? cityKeyToName(location.city) : listing.address?.split(",")[0] ?? null,
          lat: listing.lat ?? null,
          lng: listing.lng ?? null,
          type: inferType(listing.rooms, listing.buildingType, listing.title),
          disposition: listing.rooms,
          area: listing.area ?? undefined,
          condition: listing.condition ?? undefined,
          buildingType: listing.buildingType ?? undefined,
          category: location.category ?? undefined,
          floor: typeof listing.floor === "number" && listing.floor >= 0 ? listing.floor : undefined,
          totalFloors: typeof listing.totalFloors === "number" && listing.totalFloors > 0 ? listing.totalFloors : undefined,
          elevator: listing.elevator ?? undefined,
          yearBuilt: typeof listing.yearBuilt === "number" ? listing.yearBuilt : undefined,
          ownership: listing.ownership ?? undefined,
          balconyArea: listing.balconyArea ?? undefined,
          gardenArea: listing.gardenArea ?? undefined,
          cellarArea: listing.cellarArea ?? undefined,
          askingPrice: listing.price,
          sourceUrl: url,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Načtení inzerátu selhalo";
        return NextResponse.json({ error: msg.startsWith("HTTP 4") ? `Inzerát: ${msg}` : msg }, { status: 400 });
      }
    }

    // Jen URL → vrať načtená pole (UI je nechá uživateli upravit)
    if (!fields && url) {
      return NextResponse.json({ parsed: listingFields });
    }

    // ---------- Fáze 2: ocenění ----------
    if (!fields) {
      return NextResponse.json({ error: "Chybí vstupní údaje (URL nebo pole)" }, { status: 400 });
    }
    const input: ValuationInput = {
      ...listingFields,
      ...fields,
      cityKey: fields.cityKey || listingFields.cityKey || "",
      area: fields.area ?? listingFields.area ?? null,
      type: fields.type ?? listingFields.type ?? "flat",
      lat: fields.lat ?? listingFields.lat ?? null,
      lng: fields.lng ?? listingFields.lng ?? null,
      askingPrice: fields.askingPrice ?? listingFields.askingPrice ?? null,
      sourceUrl: fields.sourceUrl ?? listingFields.sourceUrl ?? null,
    };
    if (!input.cityKey || input.cityKey === "Neznámá" || input.cityKey === "unknown") {
      return NextResponse.json({ error: "Chybí město — vyberte lokalitu" }, { status: 400 });
    }
    if (!input.area || input.area <= 0) {
      return NextResponse.json({ error: "Chybí plocha (m²)" }, { status: 400 });
    }
    if (!input.address?.trim()) {
      return NextResponse.json(
        { error: "Chybí adresa — přesná adresa je nutná pro čtvrťovou přesnost odhadu" },
        { status: 400 }
      );
    }

    // Geokódování adresy → GPS (pokud inzerát neměl souřadnice) + reverse → hint na čtvrť.
    // Ward-level realizované ceny (např. Praha → Žižkov) a kompy v okruhu závisí na přesné poloze.
    let lat = input.lat ?? null;
    let lng = input.lng ?? null;
    if ((lat == null || lng == null) && input.address) {
      const g = await geocodeAddress(input.address, input.cityKey).catch(() => null);
      if (g?.lat != null && g.lng != null) {
        lat = g.lat;
        lng = g.lng;
      }
    }
    // Explicitní hinty z výběru adresy (autocomplete — Nominatim address.quarter + suburb)
    // jsou vázané přímo na vybranou adresu → mají přednost před reverse geokódem,
    // který je jen záchrana při jejich absenci (přepis by vrátil jinou čtvrť, než uživatel zvolil).
    let wardHints: string[] | null =
      input.wardHints && input.wardHints.length > 0 ? input.wardHints : null;
    if (!wardHints && lat != null && lng != null) {
      const rg = await reverseGeocode(lat, lng).catch(() => null);
      if (rg) {
        wardHints = [];
        if (rg.quarter) wardHints.push(rg.quarter);
        if (rg.suburb) wardHints.push(rg.suburb);
      }
    }
    // Dopravní vrstva (Vlak Index): reálné POI vzdálenosti metra/vlaku/busu
    // z locality modulu — per čtvrť (z URL/GPS) nebo městský průměr.
    let transport = null;
    try {
      const { getTransportDistancesForValuation } = await import("@/lib/locality/transport");
      transport = await getTransportDistancesForValuation({
        cityKey: input.cityKey,
        sourceUrl: input.sourceUrl ?? undefined,
        lat,
        lng,
        wardHints,
      });
    } catch (e) {
      console.error("Transport factor failed:", e);
    }
    // Okno realizovaných prodejů: auto dle likvidity města (velká → 6M), přepsatelné uživatelem
    const lookbackMonths: ValuationInput["lookbackMonths"] =
      fields.lookbackMonths === 6 || fields.lookbackMonths === 24
        ? fields.lookbackMonths
        : LIQUID_CITIES.has(input.cityKey)
          ? 6
          : 12;
    const enriched = { ...input, lat, lng, wardHints, transport, lookbackMonths };

    const [valuation, priceMap] = await Promise.all([
      estimateProperty(enriched),
      fetchPriceMap().catch(() => null),
    ]);
    let result = attachTrend(valuation, priceMap?.trend ?? []);
    // Odhad „k datu" — zpětný přepočet podle trendu realizovaných cen
    if (enriched.asOfDate) {
      result = scaleToDate(result, enriched.asOfDate, priceMap?.trend ?? []);
    }

    let ai = null;
    let aiCorrection = null;
    if (process.env.GEMINI_API_KEY) {
      // AI korekce potřebuje adresu/čtvrť/wardHints → enriched (má lat/lng/GPS)
      [ai, aiCorrection] = await Promise.all([
        explainValuation(input, result).catch(() => null),
        correctValuation(enriched, result).catch(() => null),
      ]);
    }

    return NextResponse.json({ valuation: result, ai, aiCorrection, parsed: listingFields, sourceUrl: url ?? null });
  } catch (error) {
    console.error("Valuation error:", error);
    return NextResponse.json({ error: "Chyba při výpočtu odhadu" }, { status: 500 });
  }
}
