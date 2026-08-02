import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { properties, priceHistory, propertyAnalysis, favorites } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { safeJsonParse, conditionLabel, formatPhone, formatPrice } from "@/lib/utils";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { PriceTag } from "@/components/ui/price-tag";
import { PropertyMap } from "@/components/ui/property-map";
import { ImageGallery } from "@/components/ui/image-gallery";
import { FavoriteButton } from "@/components/ui/favorite-button";
import PropertyDetailAnalysis from "@/components/calculator/property-detail-analysis";
import { InitiateButton } from "@/components/properties/initiate-button";
import { EditableArea } from "@/components/properties/editable-area";
import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { LocalityProfile } from "@/components/properties/locality-profile";
import { AuctionOwnerReportButton } from "@/components/properties/auction-owner-report-button";
import {
  ArrowLeft,
  ArrowUpRight,
  Phone,
  ShareNetwork,
  MapPin,
  Clock,
} from "@phosphor-icons/react/ssr";

export const dynamic = "force-dynamic";

function formatDays(firstSeen: unknown) {
  if (firstSeen == null) return "—";
  const ts = typeof firstSeen === "string" ? parseInt(firstSeen) : Number(firstSeen);
  if (isNaN(ts) || ts <= 0) return "—";
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days < 0) return "—";
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
  portaldrazeb: "Portál dražeb",
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

  const session = await auth();
  let isFavorited = false;
  if (session?.user?.id) {
    const fav = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, session.user.id),
          eq(favorites.propertyId, id)
        )
      )
      .limit(1)
      .then((r) => r[0]);
    isFavorited = !!fav;
  }

  const imageUrls: string[] = safeJsonParse<string[]>(property.imageUrls, []);
  const portalLabel = PORTAL_LABELS[property.portalName] || property.portalName;
  const hasRealUrl = property.url && property.url.startsWith("http");

  const auctionData = property.auctionDataJson
    ? (safeJsonParse(property.auctionDataJson, null) as Record<string, unknown> | null)
    : null;
  const isAuction = property.portalName === "portaldrazeb";

  function daysToAuction(): number | null {
    if (!auctionData?.auctionDate) return null;
    const d = new Date(String(auctionData.auctionDate));
    if (isNaN(d.getTime())) return null;
    return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
  }

  function fmtAuctionPrice(v: unknown): string {
    return typeof v === "number" && v > 0 ? formatPrice(v) : "—";
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
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
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
                <FavoriteButton
                  propertyId={id}
                  initialFavorited={isFavorited}
                  size={14}
                  className="glass h-8 w-8"
                />
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
                  {isAuction && (() => {
                    const days = daysToAuction();
                    return (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="rounded-lg bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[11px] text-red-400 font-semibold">
                          Dražba
                        </span>
                        {days !== null && (
                          <span className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] text-amber-400 font-semibold">
                            {days === 0 ? "Dnes dražba" : `${days} dní do dražby`}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <PriceTag
                price={property.price}
                perSqm={property.pricePerSqm ?? undefined}
                size="lg"
              />

              {history.length > 1 && (() => {
                const oldestPrice = history[history.length - 1].price;
                if (oldestPrice > property.price) {
                  const dropPct = ((oldestPrice - property.price) / oldestPrice * 100).toFixed(1);
                  return <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">Cena snížena o {dropPct} % (z {oldestPrice.toLocaleString()} Kč)</div>;
                }
                return null;
              })()}

              <div className="flex flex-wrap gap-3">
                {[
                  { label: "dispozice", value: property.rooms ?? "—" },
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
                <div className="rounded-xl bg-card-hover border border-border/50 px-3 py-2 text-xs">
                  <span className="text-muted">velikost</span>
                  <EditableArea
                    propertyId={id}
                    area={property.area}
                    areaLocked={property.areaLocked === 1}
                  />
                </div>
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
            <div className="rounded-2xl border border-border/50 bg-card p-6">
              <h2 className="font-semibold tracking-tight text-sm mb-3">Popis</h2>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{property.description}</p>
            </div>
          )}

          {/* Price History */}
          {history.length > 1 && (
            <div className="rounded-2xl border border-border/50 bg-card p-6">
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
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
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
              cityKey={analysis?.locationCity ?? null}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Zahájit jednání */}
          <InitiateButton propertyId={id} />

          {/* Lokalitní inteligence */}
          <LocalityProfile
            cityKey={analysis?.locationCity ?? null}
            district={analysis?.locationDistrict ?? null}
            aiVerdict={analysis?.aiLocalityVerdict ?? null}
          />

          {/* Dražba – výkup před dražbou */}
          {isAuction && auctionData && (
            <div className="rounded-2xl border border-red-500/20 bg-card p-5">
              <div className="flex items-center gap-2 text-sm mb-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400 text-base">⚖️</span>
                <span className="font-medium">Výkup před dražbou</span>
              </div>
              <div className="space-y-2 text-sm">
                {Boolean(auctionData.caseNumber) && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">Spisová značka</span>
                    <span className="font-mono text-xs">{String(auctionData.caseNumber)}</span>
                  </div>
                )}
                {Boolean(auctionData.auctionDate) && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted">Termín dražby</span>
                    <span className="font-mono text-xs">{formatDate(new Date(String(auctionData.auctionDate)))}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted">OC</span>
                  <span className="font-mono text-xs">{fmtAuctionPrice(auctionData.oc)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">NP</span>
                  <span className="font-mono text-xs">{fmtAuctionPrice(auctionData.np)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">TD (dluhy)</span>
                  <span className="font-mono text-xs">{fmtAuctionPrice(auctionData.td)}</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-border/30 pt-2">
                  <span className="text-muted">TBP (ideál)</span>
                  <span className="font-mono text-xs font-semibold text-accent">{fmtAuctionPrice(auctionData.tbp)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">NCO (dlužníkovi)</span>
                  <span className="font-mono text-xs font-semibold text-success">{fmtAuctionPrice(auctionData.nco)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Model</span>
                  <span className="font-mono text-xs capitalize">{auctionData.strategy === "fifty-fifty" ? "50/50" : "Sourcing fee"}</span>
                </div>
                {(auctionData.exekutor as Record<string, unknown> | null) && (() => {
                  const ex = auctionData.exekutor as Record<string, unknown>;
                  const phone = ex.phone;
                  const email = ex.email;
                  return (
                    <div className="border-t border-border/30 pt-2">
                      <p className="text-muted text-xs mb-1">Exekutor: {String(ex.name ?? "—")}</p>
                      <div className="flex flex-wrap gap-2">
                        {typeof phone === "string" && phone && (
                          <a href={`tel:${phone}`} className="rounded-lg bg-card-hover border border-accent/30 px-2.5 py-1 text-xs text-accent font-mono hover:bg-accent/10 transition-colors">
                            {phone}
                          </a>
                        )}
                        {typeof email === "string" && email && (
                          <a href={`mailto:${email}`} className="rounded-lg bg-card-hover border border-accent/30 px-2.5 py-1 text-xs text-accent hover:bg-accent/10 transition-colors">
                            {email}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="mt-4 border-t border-border/30 pt-4">
                <AuctionOwnerReportButton propertyId={id} />
              </div>
            </div>
          )}

          {/* Contact */}
          {(property.contactName || property.contactPhone || property.contactEmail) && (
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="flex items-center gap-2 text-sm mb-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent text-base">📞</span>
                <span className="font-medium">{property.contactName ?? "Kontakt"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {property.contactPhone && (
                  <a
                    href={`tel:${property.contactPhone.replace(/\s/g, "")}`}
                    className="rounded-lg bg-card-hover border border-accent/30 px-3 py-1.5 text-xs text-accent font-mono hover:bg-accent/10 transition-colors"
                  >
                    {formatPhone(property.contactPhone)}
                  </a>
                )}
                {property.contactEmail && (
                  <a
                    href={`mailto:${property.contactEmail}`}
                    className="rounded-lg bg-card-hover border border-accent/30 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 transition-colors"
                  >
                    {property.contactEmail}
                  </a>
                )}
              </div>
            </div>
          )}

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

          <DeletePropertyButton propertyId={id} />
        </div>
      </div>
    </div>
  );
}
