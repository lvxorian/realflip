import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties, priceHistory, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { PriceTag } from "@/components/ui/price-tag";
import { PropertyMap } from "@/components/ui/property-map";
import { ImageGallery } from "@/components/ui/image-gallery";
import { FlipCalculator } from "@/components/ui/flip-calculator";
import {
  ArrowLeft,
  ArrowUpRight,
  Phone,
  ShareNetwork,
  Star,
  MapPin,
  Clock,
  CurrencyDollar,
  FileText,
  WarningCircle,
  CheckCircle,
  Buildings,
} from "@phosphor-icons/react/ssr";

export const dynamic = "force-dynamic";

function fmt(p: number) {
  return `${(p / 1000000).toFixed(1)} mil. Kč`;
}

function formatDays(firstSeen: Date | number) {
  const days = Math.floor((Date.now() - new Date(firstSeen).getTime()) / 86400000);
  if (days <= 0) return "dnes";
  if (days === 1) return "1 den";
  if (days < 5) return `${days} dny`;
  return `${days} dní`;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function calcScenarios(price: number, area: number, condition: string | null, marketPriceHigh: number) {
  const needsFull = condition === "original" || condition === "dilapidated";
  const needsMedium = condition === "good" || !condition;

  function renoCost(mult: number) {
    const items = [
      { c: "Bourání", v: area * (needsFull ? 600 : 300) },
      { c: "Elektrika", v: area * (needsFull ? 1800 : needsMedium ? 1200 : 400) },
      { c: "Voda+topení", v: area * (needsFull ? 2000 : needsMedium ? 1400 : 500) },
      { c: "Podlahy", v: area * (needsFull ? 1500 : needsMedium ? 1000 : 600) },
      { c: "Malby+omítky", v: area * (needsFull ? 800 : needsMedium ? 500 : 300) },
      { c: "Koupelna", v: needsFull ? 250000 : needsMedium ? 180000 : 80000 },
      { c: "Kuchyně", v: needsFull ? 200000 : needsMedium ? 140000 : 60000 },
      { c: "Okna+dveře", v: area * (needsFull ? 1200 : needsMedium ? 600 : 200) },
    ];
    return Math.round(items.reduce((s, i) => s + i.v, 0) * mult);
  }

  function scenario(mult: number, arvMult: number, timeline: number) {
    const rc = renoCost(mult);
    const arv = Math.round(marketPriceHigh * area * arvMult);
    const sellingComm = Math.round(arv * 0.04);
    const acqCosts = Math.round(price * 0.04) + 25000 + 8000;
    const holding = Math.round((price + rc) * 0.005 * timeline);
    const fixedSell = sellingComm + 35000 + 10000;
    const totalCost = price + acqCosts + rc + holding + fixedSell;
    const netProfit = arv - totalCost;
    const incomeTax = netProfit > 0 ? Math.round(netProfit * 0.15) : 0;
    const finalCost = totalCost + incomeTax;
    const finalProfit = arv - finalCost;
    const roi = finalCost > 0 ? (finalProfit / finalCost) * 100 : 0;
    return { renovationCost: rc, arv, totalCost: finalCost, netProfit: finalProfit, roi, annualizedRoi: timeline > 0 ? (roi / timeline) * 12 : 0 };
  }

  return {
    optimistic: scenario(0.85, 1.2, 4),
    conservative: scenario(1.0, 1.05, 6),
    pessimistic: scenario(1.3, 0.9, 9),
  };
}

function calcRenovationItems(area: number, condition: string | null) {
  const needsFull = condition === "original" || condition === "dilapidated";
  const needsMedium = condition === "good" || !condition;
  return [
    { category: "Bourání", estimatedCost: Math.round(area * (needsFull ? 600 : 300)), note: needsFull ? "Plné" : "Částečné" },
    { category: "Elektrika", estimatedCost: Math.round(area * (needsFull ? 1800 : needsMedium ? 1200 : 400)), note: needsFull ? "Nová" : needsMedium ? "Částečná" : "Úpravy" },
    { category: "Voda+topení", estimatedCost: Math.round(area * (needsFull ? 2000 : needsMedium ? 1400 : 500)), note: needsFull ? "Nová" : needsMedium ? "Částečná" : "Úpravy" },
    { category: "Podlahy", estimatedCost: Math.round(area * (needsFull ? 1500 : needsMedium ? 1000 : 600)), note: needsFull ? "Vč. vyrovnání" : "Přebroušení" },
    { category: "Malby+omítky", estimatedCost: Math.round(area * (needsFull ? 800 : needsMedium ? 500 : 300)), note: needsFull ? "Nové" : "Přemalování" },
    { category: "Koupelna", estimatedCost: needsFull ? 250000 : needsMedium ? 180000 : 80000, note: needsFull ? "Komplet" : "Částečná" },
    { category: "Kuchyně", estimatedCost: needsFull ? 200000 : needsMedium ? 140000 : 60000, note: needsFull ? "Nová vč. spotř." : needsMedium ? "Nová linka" : "Úpravy" },
    { category: "Okna+dveře", estimatedCost: Math.round(area * (needsFull ? 1200 : needsMedium ? 600 : 200)), note: needsFull ? "Nová" : "Částečná" },
  ];
}

function calcTargetPrice(askingPrice: number, arv: number, renovationCost: number) {
  const TARGET_ROI = 0.15;
  const taxRate = 0.15;
  const grossTargetRatio = TARGET_ROI / (1 - taxRate);
  const targetMultiple = 1 + grossTargetRatio;
  const targetTotalCost = arv / targetMultiple;
  const acqCostRate = 0.04;
  const holdingCostRate = 0.005 * 6;
  const fixedAcqCosts = 33000;
  const sellingCosts = Math.round(arv * 0.04) + 45000;
  const totalCostNoRenov = 1 + acqCostRate + holdingCostRate * (1 + acqCostRate);
  const targetPurchasePrice = Math.round(
    (targetTotalCost - (1 + holdingCostRate) * renovationCost - sellingCosts - fixedAcqCosts * (1 + holdingCostRate)) / totalCostNoRenov
  );
  const priceReductionNeeded = Math.max(0, askingPrice - targetPurchasePrice);
  const priceReductionPct = askingPrice > 0 ? Math.round((priceReductionNeeded / askingPrice) * 100 * 10) / 10 : 0;
  return { targetPurchasePrice, priceReductionNeeded, priceReductionPct, targetROI: Math.round(TARGET_ROI * 100) };
}

const PORTAL_LABELS: Record<string, string> = {
  sreality: "Sreality.cz",
  bezrealitky: "Bezrealitky.cz",
  bazos: "Bazos.cz",
  remax: "RE/MAX",
  century21: "Century 21",
  "reality-cz": "Reality.cz",
  "idnes-reality": "Reality iDnes",
  hyperreality: "Hyperreality",
  mmreality: "MM Reality",
  annonce: "Annonce",
};

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const property = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!property) {
    notFound();
  }

  const history = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.propertyId, id))
    .orderBy(desc(priceHistory.recordedAt));

  const analysis = await db
    .select()
    .from(propertyAnalysis)
    .where(eq(propertyAnalysis.propertyId, id))
    .limit(1)
    .then((r) => r[0]);

  const imageUrls: string[] = property.imageUrls ? JSON.parse(property.imageUrls) : [];
  const portalLabel = PORTAL_LABELS[property.portalName] || property.portalName;
  const hasRealUrl = property.url && property.url.startsWith("http");

  const targetPrice = analysis?.arv && analysis?.renovationCost
    ? calcTargetPrice(property.price, analysis.arv, analysis.renovationCost)
    : null;

  const scenarios = analysis?.marketPriceMax && property.area
    ? calcScenarios(property.price, property.area, property.condition, analysis.marketPriceMax)
    : null;

  const renovationItems = property.area
    ? calcRenovationItems(property.area, property.condition)
    : null;

  let aiReport: {
    summary: string;
    negotiationTips: string[];
    hiddenInfo: string[];
  } | null = null;
  if (analysis?.aiReport) {
    try {
      aiReport = JSON.parse(analysis.aiReport);
    } catch {
      aiReport = null;
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/properties"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} weight="bold" />
        Zpět na přehled
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Hero with gallery */}
          <div className="rounded-[2.5rem] border border-border/50 bg-card overflow-hidden">
            <div className="relative">
              <ImageGallery
                images={imageUrls}
                alt={property.title}
                score={analysis?.investmentScore}
              />
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                {property.contactPhone && (
                  <a
                    href={`tel:${property.contactPhone.replace(/\s/g, "")}`}
                    className="glass h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium hover:bg-card-hover transition-colors"
                  >
                    <Phone size={14} weight="fill" />
                    Zavolat
                  </a>
                )}
                <button className="glass h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-card-hover transition-colors">
                  <ShareNetwork size={14} weight="bold" />
                </button>
                <button className="glass h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-card-hover transition-colors">
                  <Star size={14} weight="bold" />
                </button>
              </div>
              {analysis?.investmentScore !== undefined && (
                <div className="absolute top-4 left-4 z-10 glass rounded-xl px-3 py-2 flex items-center gap-2">
                  <ScoreGauge score={analysis.investmentScore} size={36} strokeWidth={3} />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted font-mono">skóre</span>
                    <span className="text-sm font-semibold">{analysis.investmentScore}/100</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">{property.title}</h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted flex-wrap">
                  <MapPin size={14} weight="bold" />
                  {property.address || "Neznámá adresa"}
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <Clock size={14} weight="bold" />
                  {formatDays(property.firstSeen)} na trhu
                </div>
              </div>

              <PriceTag
                price={property.price}
                perSqm={property.pricePerSqm ?? undefined}
                size="lg"
              />

              <div className="flex flex-wrap gap-3">
                {[
                  { label: "dispozice", value: property.rooms ?? "—" },
                  { label: "m²", value: property.area ? `${property.area} m²` : "—" },
                  { label: "patro", value: property.floor ? `${property.floor}.` : "—" },
                  { label: "stav", value: property.condition ?? "—" },
                  { label: "rok", value: property.yearBuilt ?? "—" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl bg-white/[0.02] border border-white/5 px-4 py-2.5 text-center min-w-[72px]"
                  >
                    <p className="font-semibold text-sm">{s.value}</p>
                    <p className="text-[10px] text-muted">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info" size="sm">
                  {portalLabel}
                </Badge>
                <Badge variant="outline" size="sm">
                  ID: {property.id.slice(0, 12)}
                </Badge>
                {hasRealUrl && (
                  <a
                    href={property.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    Otevřít inzerát na {portalLabel}
                    <ArrowUpRight size={12} weight="bold" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <h2 className="font-semibold tracking-tight text-sm mb-3 flex items-center gap-2">
              <Buildings size={14} weight="duotone" className="text-accent" />
              Popis
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              {property.description || "Popis není k dispozici."}
            </p>
          </div>

          {/* Price History */}
          {history.length > 0 && (
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="font-semibold tracking-tight text-sm mb-3">Historie cen</h2>
              <div className="space-y-2">
                {history.map((ph) => (
                  <div
                    key={ph.id}
                    className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-4 py-3"
                  >
                    <span className="text-sm text-muted">{formatDate(ph.recordedAt)}</span>
                    <span className="text-sm font-mono font-medium">{fmt(ph.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <h2 className="font-semibold tracking-tight text-sm mb-3 flex items-center gap-2">
              <MapPin size={14} weight="duotone" className="text-accent" />
              Lokalita
            </h2>
            <PropertyMap
              address={property.address ?? "Neznámá adresa"}
              lat={property.lat ?? undefined}
              lng={property.lng ?? undefined}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {analysis && (
            <>
              {/* Verdict */}
              {analysis.verdictLevel && (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                      analysis.verdictLevel === "strongBuy" ? "bg-emerald-500/20 text-emerald-400" :
                      analysis.verdictLevel === "buy" ? "bg-emerald-500/15 text-emerald-400" :
                      analysis.verdictLevel === "consider" ? "bg-amber-500/15 text-amber-400" :
                      analysis.verdictLevel === "dontBuy" ? "bg-red-500/15 text-red-400" :
                      "bg-red-600/20 text-red-400"
                    }`}>
                      {analysis.verdictLevel === "strongBuy" || analysis.verdictLevel === "buy" ? "🟢" :
                       analysis.verdictLevel === "consider" ? "🟡" : "🔴"}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {analysis.verdictLevel === "strongBuy" ? "SILNĚ DOPORUČUJI" :
                         analysis.verdictLevel === "buy" ? "DOPORUČUJI" :
                         analysis.verdictLevel === "consider" ? "ZVAŽUJTE OPATRNĚ" :
                         analysis.verdictLevel === "dontBuy" ? "NEDOPORUČUJI" :
                         "KATEGORICKY ODMÍTNOUT"}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{analysis.verdictSummary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <span className="font-mono">Skóre {analysis.investmentScore}/100</span>
                    <span className="w-0.5 h-0.5 rounded-full bg-border" />
                    <span>Marže {(analysis.roi ?? 0).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {/* Market Price Analysis */}
              {analysis.marketPriceMin != null && analysis.marketPriceMax != null && (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <h2 className="font-semibold tracking-tight text-sm mb-3 flex items-center gap-2">
                    <CurrencyDollar size={14} className="text-accent" weight="duotone" />
                    Cenová analýza trhu
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Inzerovaná cena</span>
                      <span className="font-mono font-medium">{(property.price / 1000000).toFixed(1)} mil. Kč</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Tržní rozmezí</span>
                      <span className="font-mono font-medium text-emerald-400">
                        {(analysis.marketPriceMin * (property.area ?? 1) / 1000000).toFixed(1)} – {(analysis.marketPriceMax * (property.area ?? 1) / 1000000).toFixed(1)} mil. Kč
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-border/30 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-emerald-500/30 rounded-full" style={{
                        left: `${Math.max(0, Math.min(90, (analysis.marketPriceMin / analysis.marketPriceMax) * 50))}%`,
                        width: `${Math.min(50, ((analysis.marketPriceMax - analysis.marketPriceMin) / analysis.marketPriceMax) * 50 + 10)}%`,
                      }} />
                      <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 bg-white/80 rounded-full" style={{
                        left: `${Math.min(95, Math.max(5, (property.pricePerSqm ?? analysis.marketPriceMin) / analysis.marketPriceMax * 100))}%`,
                      }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted">
                      <span>{((analysis.marketPriceMin ?? 0) / 1000).toFixed(0)} tis. Kč/m²</span>
                      <span className="font-semibold text-white/60">Aktuální</span>
                      <span>{((analysis.marketPriceMax ?? 0) / 1000).toFixed(0)} tis. Kč/m²</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {analysis.undervaluationPct != null && analysis.undervaluationPct > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 flex-1">
                          <ArrowUpRight size={14} className="text-emerald-400" weight="bold" />
                          <div>
                            <span className="text-[10px] text-muted">Podhodnoceno</span>
                            <p className="text-xs font-semibold font-mono text-emerald-400">{Math.round(analysis.undervaluationPct)} %</p>
                          </div>
                        </div>
                      )}
                      {analysis.overpricingPct != null && analysis.overpricingPct > 0 && (
                        <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex-1">
                          <WarningCircle size={14} className="text-amber-400" weight="fill" />
                          <div>
                            <span className="text-[10px] text-muted">Přeplaceno</span>
                            <p className="text-xs font-semibold font-mono text-amber-400">{Math.round(analysis.overpricingPct)} %</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Location & Price Analysis */}
              {/* Target price */}
              {targetPrice && (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <h2 className="font-semibold tracking-tight text-sm mb-3">Cenový cíl</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Aktuální cena</span>
                      <span className="font-mono font-medium">{(property.price / 1000000).toFixed(1)} mil. Kč</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/40"
                        style={{ width: `${Math.min(100, (targetPrice.targetPurchasePrice / property.price) * 100)}%` }}
                      />
                      <div
                        className="absolute inset-y-0 rounded-full bg-white/20"
                        style={{
                          left: `${Math.min(100, (targetPrice.targetPurchasePrice / property.price) * 100)}%`,
                          width: `${Math.min(100, Math.max(2, ((property.price - targetPrice.targetPurchasePrice) / property.price) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Cílový nákup</span>
                      <span className="font-mono font-medium text-emerald-400">
                        {(targetPrice.targetPurchasePrice / 1000000).toFixed(1)} mil. Kč
                      </span>
                    </div>
                    {targetPrice.priceReductionNeeded > 0 && (
                      <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted">Potřebná sleva</span>
                          <span className="font-mono font-semibold text-amber-400">
                            {(targetPrice.priceReductionNeeded / 1000000).toFixed(1)} mil. Kč
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-muted">Z celkové ceny</span>
                          <span className={`font-mono font-semibold ${
                            targetPrice.priceReductionPct > 15 ? "text-red-400" :
                            targetPrice.priceReductionPct > 5 ? "text-amber-400" :
                            "text-emerald-400"
                          }`}>
                            −{targetPrice.priceReductionPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-muted">Cílová marže</span>
                          <span className="font-mono font-semibold text-emerald-400">
                            {targetPrice.targetROI.toFixed(0)} % ROI
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location & Price Analysis */}
              {analysis.locationCity && (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <h2 className="font-semibold tracking-tight text-sm mb-3">Lokalita & cena</h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                      <p className="text-[10px] text-muted mb-1">Město</p>
                      <p className="font-semibold text-sm capitalize">{analysis.locationCity}</p>
                      {analysis.locationDistrict && (
                        <p className="text-[10px] text-muted mt-0.5 capitalize">{analysis.locationDistrict}</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                      <p className="text-[10px] text-muted mb-1">Kategorie</p>
                      <p className={`font-semibold text-sm ${
                        analysis.locationCategory === "premium" ? "text-emerald-400" :
                        analysis.locationCategory === "stable" ? "text-amber-400" :
                        "text-red-400"
                      }`}>
                        {analysis.locationCategory === "premium" ? "Prémiová" :
                         analysis.locationCategory === "stable" ? "Stabilní" :
                         analysis.locationCategory === "risky" ? "Riziková" : "Neznámá"}
                      </p>
                    </div>
                    {analysis.pricePerSqm != null && analysis.pricePerSqm > 0 && (
                      <>
                        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                          <p className="text-[10px] text-muted mb-1">Cena/m²</p>
                          <p className="font-semibold text-sm font-mono">
                            {(analysis.pricePerSqm / 1000).toFixed(0)} tis. Kč
                          </p>
                        </div>
                        {analysis.marketPriceMin != null && analysis.marketPriceMax != null && (
                          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
                            <p className="text-[10px] text-muted mb-1">Trh/m²</p>
                            <p className="font-semibold text-sm font-mono">
                              {(analysis.marketPriceMin / 1000).toFixed(0)}–{(analysis.marketPriceMax / 1000).toFixed(0)} tis.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {analysis.overpricingPct != null && analysis.overpricingPct !== 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="text-muted">Přeplaceno:</span>
                      <span className={`font-mono font-medium ${
                        analysis.overpricingPct > 10 ? "text-red-400" :
                        analysis.overpricingPct > 0 ? "text-amber-400" :
                        "text-emerald-400"
                      }`}>
                        {analysis.overpricingPct > 0 ? "+" : ""}{analysis.overpricingPct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Investment Analysis */}
              <div className="rounded-2xl border border-border/50 card-gradient-accent p-5">
                <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2 mb-4">
                  <CurrencyDollar size={16} className="text-accent" weight="duotone" />
                  Investiční analýza
                </h2>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: "Tržní hodnota (ARV)", value: fmt(analysis.arv ?? 0), color: "" },
                    { label: "Celkové náklady", value: fmt(analysis.totalCost ?? 0), color: "" },
                    { label: "Zisk", value: fmt(analysis.netProfit ?? 0), color: "text-emerald-400" },
                    { label: "ROI", value: `${(analysis.roi ?? 0).toFixed(1)}%`, color: "text-emerald-400" },
                    { label: "Annualized ROI", value: `${(analysis.annualizedRoi ?? 0).toFixed(1)}%`, color: "" },
                    { label: "Cash-on-Cash", value: `${(analysis.cashOnCash ?? 0).toFixed(1)}%`, color: "" },
                    { label: "Break-even", value: `${((analysis.breakEvenPrice ?? 0) / 1000000).toFixed(1)} mil.`, color: "" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-muted">{r.label}</span>
                      <span className={`font-mono font-medium ${r.color}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 Scenarios */}
              {scenarios && (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <h2 className="font-semibold tracking-tight text-sm mb-3">3 scénáře</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {(["optimistic", "conservative", "pessimistic"] as const).map((key) => {
                      const s = scenarios[key];
                      return (
                        <div key={key} className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                          key === "optimistic" ? "border-emerald-500/20 bg-emerald-500/5" :
                          key === "conservative" ? "border-accent/20 bg-accent/5" :
                          "border-red-500/20 bg-red-500/5"
                        }`}>
                          <p className="font-semibold text-[11px] tracking-tight uppercase">
                            {key === "optimistic" ? "Optimistický" : key === "conservative" ? "Konzervativní" : "Pesimistický"}
                          </p>
                          <div className="flex justify-between"><span className="text-muted">ARV</span><span className="font-mono">{(s.arv / 1000000).toFixed(1)} mil.</span></div>
                          <div className="flex justify-between"><span className="text-muted">Rekonstrukce</span><span className="font-mono">{(s.renovationCost / 1000000).toFixed(1)} mil.</span></div>
                          <div className="flex justify-between"><span className="text-muted">Zisk</span><span className={`font-mono ${s.netProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>{(s.netProfit / 1000000).toFixed(1)} mil.</span></div>
                          <div className="flex justify-between"><span className="text-muted">ROI</span><span className={`font-mono ${s.roi > 10 ? "text-emerald-400" : s.roi > 0 ? "text-amber-400" : "text-red-400"}`}>{s.roi.toFixed(1)}%</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Renovation Items */}
              {renovationItems && (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <h2 className="font-semibold tracking-tight text-sm mb-3">Odhad rekonstrukce ({renovationItems.reduce((s, i) => s + i.estimatedCost, 0).toLocaleString()} Kč)</h2>
                  <div className="space-y-1.5">
                    {renovationItems.map((item, i) => {
                      const pct = item.estimatedCost / renovationItems.reduce((s, i) => s + i.estimatedCost, 0) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium truncate">{item.category}</span>
                              <span className="font-mono text-muted shrink-0 ml-2">{item.estimatedCost.toLocaleString()} Kč</span>
                            </div>
                            <div className="h-1 rounded-full bg-border/30 overflow-hidden mt-1">
                              <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                          <span className="text-[10px] text-muted w-20 text-right shrink-0">{item.note}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Red Flags */}
              {analysis.redFlagsJson && (() => {
                const flags = JSON.parse(analysis.redFlagsJson);
                if (flags.length === 0) return null;
                return (
                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2 mb-3">
                      <WarningCircle size={14} className="text-amber-400" weight="duotone" />
                      Red flags ({flags.length})
                    </h2>
                    <ul className="space-y-2">
                      {flags.map((f: any, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                            f.severity === "high" ? "bg-red-400" :
                            f.severity === "medium" ? "bg-amber-400" : "bg-muted"
                          }`} />
                          <span className="text-muted">{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              {/* Technical details */}
              {(analysis.technicalScore || analysis.segmentRating || analysis.buildingType) && (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <h2 className="font-semibold tracking-tight text-sm mb-3">Technický stav</h2>
                  <div className="flex flex-wrap gap-2">
                    {analysis.segmentRating && (
                      <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                        <p className="text-[10px] text-muted">Segment</p>
                        <p className="text-xs font-semibold">
                          {analysis.segmentRating === "best" ? "✅ Ideální (45-75 m²)" :
                           analysis.segmentRating === "good" ? "✅ Dobrý" :
                           analysis.segmentRating === "ok" ? "➖ Přijatelný" :
                           analysis.segmentRating === "niche" ? "⚠️ Úzký trh" : "❌ Nevhodný"}
                        </p>
                      </div>
                    )}
                    {analysis.buildingType && (
                      <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                        <p className="text-[10px] text-muted">Konstrukce</p>
                        <p className="text-xs font-semibold capitalize">{analysis.buildingType}</p>
                      </div>
                    )}
                    {analysis.occupancy && analysis.occupancy !== "unknown" && (
                      <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                        <p className="text-[10px] text-muted">Obsazeno</p>
                        <p className={`text-xs font-semibold ${analysis.occupancy === "occupied" ? "text-red-400" : "text-emerald-400"}`}>
                          {analysis.occupancy === "free" ? "Volný" : "⚠️ Nájemník"}
                        </p>
                      </div>
                    )}
                    {analysis.energyLabel && (
                      <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                        <p className="text-[10px] text-muted">Štítek</p>
                        <p className="text-xs font-semibold">{analysis.energyLabel}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Alternative strategies */}
              {analysis.alternativeStrategiesJson && (() => {
                const strategies = JSON.parse(analysis.alternativeStrategiesJson);
                if (strategies.length === 0) return null;
                return (
                  <div className="rounded-2xl border border-border/50 bg-card p-5">
                    <h2 className="font-semibold tracking-tight text-sm mb-3">Alternativní strategie</h2>
                    <ul className="space-y-1.5">
                      {strategies.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted">
                          <span className="text-emerald-400 mt-0.5">◆</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </>
          )}


          <FlipCalculator
            initialPrice={property.price}
            renovationCost={analysis?.renovationCost ?? Math.round((property.area ?? 50) * 10000)}
          />

          {(aiReport || analysis) && (
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2 mb-4">
                <FileText size={16} className="text-accent" weight="duotone" />
                AI Report
              </h2>
              {aiReport ? (
                <>
                  <p className="text-sm text-muted leading-relaxed mb-4">
                    {aiReport.summary}
                  </p>
                  {aiReport.negotiationTips?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-emerald-400 mb-1.5">
                        Vyjednávací tipy
                      </p>
                      <ul className="space-y-1">
                        {aiReport.negotiationTips.map((tip, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs text-muted"
                          >
                            <CheckCircle
                              size={12}
                              className="text-emerald-400 mt-0.5 shrink-0"
                              weight="fill"
                            />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiReport.hiddenInfo?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-400 mb-1.5">
                        Skryté informace
                      </p>
                      <ul className="space-y-1">
                        {aiReport.hiddenInfo.map((info, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-xs text-muted"
                          >
                            <WarningCircle
                              size={12}
                              className="text-amber-400 mt-0.5 shrink-0"
                              weight="fill"
                            />
                            {info}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted leading-relaxed">
                  AI analýza ještě nebyla vygenerována. Spusťte analyzátor pro tuto
                  nemovitost.
                </p>
              )}
            </div>
          )}

          {/* Contact info */}
          {/* Create Deal */}
          {analysis && (
            <form action="/api/deals" method="POST" className="block">
              <input type="hidden" name="propertyId" value={property.id} />
              <input type="hidden" name="purchasePrice" value={property.price} />
              <input type="hidden" name="renovationBudget" value={analysis.renovationCost ?? 0} />
              <button type="submit"
                className="w-full rounded-2xl border border-accent/30 bg-accent/5 p-4 hover:bg-accent/10 transition-all text-left group"
              >
                <p className="font-semibold tracking-tight text-sm group-hover:text-accent transition-colors">Vytvořit projekt</p>
                <p className="text-xs text-muted mt-0.5">Založit nový reflip projekt z tohoto inzerátu</p>
              </button>
            </form>
          )}

          {(property.contactName || property.contactPhone || property.contactEmail) && (
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <h2 className="font-semibold tracking-tight text-sm mb-3">Kontakt</h2>
              <div className="space-y-2 text-sm">
                {property.contactName && (
                  <div className="flex justify-between">
                    <span className="text-muted">Jméno</span>
                    <span>{property.contactName}</span>
                  </div>
                )}
                {property.contactPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted">Telefon</span>
                    <a
                      href={`tel:${property.contactPhone.replace(/\s/g, "")}`}
                      className="font-mono text-accent hover:underline"
                    >
                      {property.contactPhone}
                    </a>
                  </div>
                )}
                {property.contactEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted">E-mail</span>
                    <a
                      href={`mailto:${property.contactEmail}`}
                      className="text-accent hover:underline"
                    >
                      {property.contactEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
