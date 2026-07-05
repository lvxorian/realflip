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

function formatDays(firstSeen: Date) {
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

  const recommendationLabel =
    analysis?.recommendation === "buy"
      ? "DOPORUČENO K INVESTICI"
      : analysis?.recommendation === "consider"
      ? "ZVAŽIT"
      : analysis?.recommendation === "skip"
      ? "NEDOPORUČENO"
      : null;
  const recommendationVariant =
    analysis?.recommendation === "buy"
      ? "success"
      : analysis?.recommendation === "consider"
      ? "warning"
      : "danger";

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
            <div className="rounded-2xl border border-border/50 card-gradient-accent p-5">
              <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2 mb-4">
                <CurrencyDollar size={16} className="text-accent" weight="duotone" />
                Investiční analýza
              </h2>
              <div className="space-y-2.5 text-sm">
                {[
                  { label: "Tržní hodnota", value: fmt(analysis.marketValue), color: "" },
                  {
                    label: "Podhodnocení",
                    value: `${analysis.undervaluationPct.toFixed(1)}%`,
                    color: "text-emerald-400",
                  },
                  { label: "ARV", value: fmt(analysis.arv ?? 0), color: "" },
                  {
                    label: "Zisk",
                    value: fmt(analysis.netProfit ?? 0),
                    color: "text-emerald-400",
                  },
                  {
                    label: "ROI",
                    value: `${(analysis.roi ?? 0).toFixed(1)}%`,
                    color: "text-emerald-400",
                  },
                  {
                    label: "Annualized ROI",
                    value: `${(analysis.annualizedRoi ?? 0).toFixed(1)}%`,
                    color: "",
                  },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-muted">{r.label}</span>
                    <span className={`font-mono font-medium ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
              {recommendationLabel && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <Badge
                    variant={recommendationVariant as "success" | "warning" | "danger"}
                    size="lg"
                    className="w-full justify-center py-2 text-sm gap-1.5"
                  >
                    {recommendationVariant === "success" && <CheckCircle size={14} weight="fill" />}
                    {recommendationLabel}
                  </Badge>
                </div>
              )}
            </div>
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
