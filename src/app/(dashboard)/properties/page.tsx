import { db, schema } from "@/db";
import { eq, desc, inArray } from "drizzle-orm";
import { safeJsonParse } from "@/lib/utils";
import Link from "next/link";
import { PropertiesExplorer, type PropertyListItem } from "@/components/ui/properties-explorer";

const { properties, propertyAnalysis, searchProperties, searches } = schema;

export const dynamic = "force-dynamic";

const PORTAL_LABELS: Record<string, string> = {
  sreality: "Sreality",
  bezrealitky: "Bezrealitky",
  bazos: "Bazos",
  annonce: "Annonce",
  mmreality: "M&M Reality",
  "idnes-reality": "iDnes Reality",
  hyperreality: "Hyperreality",
  "reality-cz": "Reality.cz",
  remax: "RE/MAX",
  century21: "Century 21",
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ searchId?: string }>;
}) {
  try {
    const { searchId } = await searchParams;

    const allSearches = await db
      .select({ id: searches.id, name: searches.name })
      .from(searches)
      .orderBy(desc(searches.createdAt));

    let activeSearchName = "";
    let propertyIds: string[] = [];

    if (searchId && allSearches.some((s) => s.id === searchId)) {
      activeSearchName = allSearches.find((s) => s.id === searchId)?.name ?? "";
      const linked = await db
        .select({ propertyId: searchProperties.propertyId })
        .from(searchProperties)
        .where(eq(searchProperties.searchId, searchId));
      propertyIds = linked.map((l) => l.propertyId);
    }

    const baseQuery = db
      .select({
      id: properties.id,
      title: properties.title,
      price: properties.price,
      pricePerSqm: properties.pricePerSqm,
      area: properties.area,
      rooms: properties.rooms,
      address: properties.address,
      imageUrls: properties.imageUrls,
      firstSeen: properties.firstSeen,
      portalName: properties.portalName,
      condition: properties.condition,
      score: propertyAnalysis.investmentScore,
      recommendation: propertyAnalysis.recommendation,
      locationCity: propertyAnalysis.locationCity,
      verdictLevel: propertyAnalysis.verdictLevel,
      roi: propertyAnalysis.roi,
      arv: propertyAnalysis.arv,
      renovationCost: propertyAnalysis.renovationCost,
      netProfit: propertyAnalysis.netProfit,
      totalCost: propertyAnalysis.totalCost,
      marketPriceMin: propertyAnalysis.marketPriceMin,
      marketPriceMax: propertyAnalysis.marketPriceMax,
      undervaluationPct: propertyAnalysis.undervaluationPct,
      overpricingPct: propertyAnalysis.overpricingPct,
    })
    .from(properties)
    .leftJoin(propertyAnalysis, eq(propertyAnalysis.propertyId, properties.id))
    .where(
      searchId && propertyIds.length > 0
        ? inArray(properties.id, propertyIds)
        : eq(properties.isActive, 1 as any)
    )
    .orderBy(desc(properties.firstSeen));

  const rows = await baseQuery;

  const now = Date.now();
  const items: PropertyListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    pricePerSqm: r.pricePerSqm,
    area: r.area,
    rooms: r.rooms,
    address: r.address,
    portalName: r.portalName,
    condition: r.condition,
    locationCity: r.locationCity,
    verdictLevel: r.verdictLevel,
    roi: r.roi,
    arv: r.arv,
    renovationCost: r.renovationCost,
    netProfit: r.netProfit,
    totalCost: r.totalCost,
    score: r.score,
    recommendation: r.recommendation,
    undervaluationPct: r.undervaluationPct,
    overpricingPct: r.overpricingPct,
    marketPriceMin: r.marketPriceMin,
    marketPriceMax: r.marketPriceMax,
    daysOnMarket: Math.max(
      0,
      Math.floor((now - new Date(r.firstSeen).getTime()) / 86400000)
    ),
    imageUrls: safeJsonParse<string[]>(r.imageUrls, []),
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3 text-sm">
        <span className="text-muted">💡</span>
        <p className="text-muted flex-1">
          Toto jsou všechna naskenovaná data. Pro cílené výsledky podle lokality, ceny a plochy vytvořte{" "}
          <Link href="/searches/new" className="text-accent hover:underline">nové hledání</Link>.
        </p>
        <Link href="/searches">
          <span className="text-xs text-accent hover:underline whitespace-nowrap">Spravovat hledání →</span>
        </Link>
      </div>

      <form
        method="GET"
        className="flex items-center gap-3"
      >
        <select
          name="searchId"
          onChange={(e) => { if (e.target.form) e.target.form.submit(); }}
          className="h-10 rounded-lg border border-border/50 bg-card px-3 text-sm text-foreground focus:outline-none focus:border-accent/50 cursor-pointer"
          value={searchId ?? ""}
        >
          <option value="">Všechny inzeráty</option>
          {allSearches.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {searchId && (
          <Link
            href="/properties"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            × Zrušit filtr
          </Link>
        )}
        <span className="text-xs text-muted ml-auto">
          {activeSearchName ? `Filtrováno: ${activeSearchName}` : `${items.length} inzerátů`}
        </span>
      </form>

      <PropertiesExplorer items={items} />
    </div>
  );
  } catch (e) {
    const err = e as Error & { digest?: string; cause?: unknown };
    const parts: string[] = [];
    parts.push(`message: ${err.message}`);
    if (err.digest) parts.push(`digest: ${err.digest}`);
    if (err.stack) parts.push(`stack: ${err.stack}`);
    if (err.cause) {
      const c = err.cause as Error;
      parts.push(`cause message: ${c.message || c}`);
      if (c.stack) parts.push(`cause stack: ${c.stack}`);
    }
    const extraProps = Object.getOwnPropertyNames(err)
      .filter((k) => !["message", "stack", "cause", "digest"].includes(k))
      .map((k) => `[${k}]: ${String((err as any)[k])}`);
    if (extraProps.length) parts.push(`extra props: ${extraProps.join(" | ")}`);

    console.error("PropertiesPage error:", err);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h2 className="text-lg font-semibold tracking-tight text-red-400">Chyba při načítání</h2>
          <p className="text-sm text-muted mt-1">Nepodařilo se načíst seznam nemovitostí.</p>
          <details className="mt-4">
            <summary className="text-xs text-red-400/80 cursor-pointer font-medium">Detail chyby</summary>
            <pre className="mt-2 text-xs text-red-400/70 whitespace-pre-wrap break-all">{parts.join("\n\n")}</pre>
          </details>
        </div>
      </div>
    );
  }
}
