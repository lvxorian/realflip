import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties, priceHistory, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { safeJsonParse, conditionLabel } from "@/lib/utils";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { PriceTag } from "@/components/ui/price-tag";
import { PropertyMap } from "@/components/ui/property-map";
import { ImageGallery } from "@/components/ui/image-gallery";
import PropertyDetailAnalysis from "@/components/calculator/property-detail-analysis";
import {
  ArrowLeft,
  ArrowUpRight,
  Phone,
  ShareNetwork,
  Star,
  MapPin,
  Clock,
} from "@phosphor-icons/react/ssr";

export const dynamic = "force-dynamic";

function formatDays(firstSeen: Date | number | null | undefined) {
  if (!firstSeen) return "—";
  const days = Math.floor((Date.now() - new Date(firstSeen).getTime()) / 86400000);
  if (isNaN(days) || days < 0) return "—";
  if (days === 0) return "dnes";
  if (days === 1) return "1 den";
  if (days < 5) return `${days} dny`;
  return `${days} dní`;
}

function formatDate(d: Date | number) {
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

  const imageUrls: string[] = safeJsonParse<string[]>(property.imageUrls, []);
  const portalLabel = PORTAL_LABELS[property.portalName] || property.portalName;
  const hasRealUrl = property.url && property.url.startsWith("http");

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
                  { label: "stav", value: conditionLabel(property.condition) },
                  { label: "rok", value: property.yearBuilt ?? "—" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl bg-card-hover border border-border/50 px-3 py-2 text-xs"
                  >
                    <span className="text-muted">{s.label}</span>
                    <p className="font-semibold text-foreground font-mono mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              <a
                href={property.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <ArrowUpRight size={14} weight="bold" />
                Zobrazit na {portalLabel}
              </a>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div className="rounded-[2.5rem] border border-border/50 bg-card p-6">
              <h2 className="font-semibold tracking-tight text-sm mb-3">Popis</h2>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{property.description}</p>
            </div>
          )}

          {/* Price History */}
          {history.length > 1 && (
            <div className="rounded-[2.5rem] border border-border/50 bg-card p-6">
              <h2 className="font-semibold tracking-tight text-sm mb-4">Historie ceny</h2>
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{formatDate(h.recordedAt)}</span>
                    <span className="font-mono font-semibold">{(h.price / 1000000).toFixed(1)} mil. Kč</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          <div className="rounded-[2.5rem] border border-border/50 bg-card overflow-hidden">
            <div className="p-6 pb-3">
              <h2 className="font-semibold tracking-tight text-sm flex items-center gap-2">
                <MapPin size={14} className="text-accent" weight="duotone" />
                Lokalita
              </h2>
            </div>
            <PropertyMap
              address={property.address ?? "Neznámá adresa"}
              lat={property.lat ?? undefined}
              lng={property.lng ?? undefined}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <PropertyDetailAnalysis
            property={{
              id: property.id,
              title: property.title,
              price: property.price,
              pricePerSqm: property.pricePerSqm,
              area: property.area,
              rooms: property.rooms,
              floor: property.floor,
              condition: property.condition,
              buildingType: property.buildingType,
              yearBuilt: property.yearBuilt,
              address: property.address,
              lat: property.lat,
              lng: property.lng,
              contactPhone: property.contactPhone,
              contactName: property.contactName,
              contactEmail: property.contactEmail,
              description: property.description,
              imageUrls,
              url: property.url,
              portalName: property.portalName,
            }}
            analysis={analysis ? {
              id: analysis.id,
              marketValue: analysis.marketValue,
              undervaluationPct: analysis.undervaluationPct,
              investmentScore: analysis.investmentScore,
              arv: analysis.arv,
              renovationCost: analysis.renovationCost,
              totalCost: analysis.totalCost,
              netProfit: analysis.netProfit,
              roi: analysis.roi,
              annualizedRoi: analysis.annualizedRoi,
              cashOnCash: analysis.cashOnCash,
              breakEvenPrice: analysis.breakEvenPrice,
              recommendation: analysis.recommendation,
              pricePerSqm: analysis.pricePerSqm,
              marketPriceMin: analysis.marketPriceMin,
              marketPriceMax: analysis.marketPriceMax,
              overpricingPct: analysis.overpricingPct,
              locationCategory: analysis.locationCategory,
              locationCity: analysis.locationCity,
              locationDistrict: analysis.locationDistrict,
              segmentRating: analysis.segmentRating,
              occupancy: analysis.occupancy,
              buildingType: analysis.buildingType,
              energyLabel: analysis.energyLabel,
              technicalScore: analysis.technicalScore,
              verdictLevel: analysis.verdictLevel,
              verdictSummary: analysis.verdictSummary,
              redFlagsJson: analysis.redFlagsJson,
              costsJson: analysis.costsJson,
              alternativeStrategiesJson: analysis.alternativeStrategiesJson,
              rentalYield: analysis.rentalYield,
              aiReport: analysis.aiReport,
            } : null}
          />

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

          {/* PDF Report */}
          <Link
            href={`/report/${property.id}`}
            className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover hover:border-accent/20 transition-all block"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.048 48.048 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">PDF Report</p>
                <p className="text-xs text-muted">Investiční analýza ke stažení</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
