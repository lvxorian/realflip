"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { MagnifyingGlass, CheckCircle, XCircle, Copy, Trash } from "@phosphor-icons/react";

interface AnalysisResult {
  url: string;
  portal: string;
  success: boolean;
  error?: string;
  listing?: {
    title: string;
    price: number;
    area: number | null;
    rooms: string;
    condition: string | null;
    address: string | null;
    description: string | null;
    imageUrls: string[];
  };
  analysis?: {
    pricePerSqm: number;
    marketPricePerSqmLow: number;
    marketPricePerSqmHigh: number;
    undervaluationPct: number;
    overpricingPct: number;
    investmentScore: number;
    verdictLevel: string;
    recommendation: string;
    verdictSummary: string | null;
    arv: number;
    roi: number;
    netProfit: number;
    targetPurchasePrice: number;
    priceReductionNeeded: number;
    priceReductionPct: number;
    condition: string | null;
    location: { city: string; category: string } | null;
    buildingType: string;
    segmentRating: string;
    occupancy: string;
    missingFields: string[];
    redFlags: { type: string; description: string }[];
    scenarios: Record<string, {
      label: string;
      renovationCost: number;
      arv: number;
      totalCost: number;
      netProfit: number;
      roi: number;
    }>;
  };
  aiSummary?: string | null;
  aiNegotiationTips?: string[] | null;
  aiComparableNotes?: string | null;
  aiHiddenInfo?: string[] | null;
}

const verdictColors: Record<string, string> = {
  strongBuy: "success",
  buy: "success",
  consider: "warning",
  dontBuy: "danger",
  categoricalReject: "danger",
};

const verdictLabels: Record<string, string> = {
  strongBuy: "Silný kandidát",
  buy: "Doporučeno",
  consider: "Zvážit",
  dontBuy: "Nedoporučeno",
  categoricalReject: "Zamítnout",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 20 },
  },
};

export default function AnalyzerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [urlText, setUrlText] = useState("");
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const urls = urlText
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && (u.startsWith("http://") || u.startsWith("https://")));

  const handleSubmit = async () => {
    if (urls.length === 0) return;
    setLoading(true);
    setResults([]);
    setStepIndex(0);
    setShowOnlyProblems(false);

    const steps = Math.min(urls.length, 10);
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= steps) {
          clearInterval(interval);
          return steps;
        }
        return prev + 1;
      });
    }, 800);

    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: urls.slice(0, 10) }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      }
    } catch {
      // ignore
    } finally {
      clearInterval(interval);
      setStepIndex(steps);
      setLoading(false);
    }
  };

  const handleCopyAll = async () => {
    const text = results
      .filter((r) => !showOnlyProblems || !r.success)
      .map((r) => {
        const line = [`${r.url}`];
        if (r.success) {
          const a = r.analysis!;
          line.push(
            `  ${verdictLabels[a.verdictLevel] ?? a.verdictLevel} | Skóre: ${a.investmentScore} | ROI: ${a.roi.toFixed(1)}% | Zisk: ${formatPrice(a.netProfit)}`
          );
        } else {
          line.push(`  ❌ ${r.error}`);
        }
        return line.join("\n");
      })
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopiedId("all");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setUrlText("");
    setResults([]);
    setStepIndex(-1);
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted">Načítání...</p>
        </div>
      </div>
    );
  }

  const activeUrls = urls.slice(0, 10);

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analyzátor nemovitostí</h1>
        <p className="text-sm text-muted mt-1">
          Vložte URL inzerátů a získejte detailní analýzu s AI hodnocením
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                placeholder="Vložte URL inzerátů (každou na nový řádek, max 10)"
                rows={5}
                className="w-full resize-none rounded-xl border border-border/50 bg-card px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {urlText.length > 0 && (
                <button
                  onClick={handleClear}
                  className="absolute top-3 right-3 p-1 rounded-lg hover:bg-card-hover text-muted hover:text-foreground transition-colors"
                >
                  <Trash size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={urls.length === 0 || loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Analyzuji...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass size={16} weight="bold" />
                    Analyzovat ({activeUrls.length})
                  </>
                )}
              </Button>
              {urls.length > 10 && (
                <p className="text-xs text-amber-400">Pouze prvních 10 URL bude zpracováno</p>
              )}
              {results.length > 0 && (
                <span className="text-xs text-muted ml-auto">
                  {results.filter((r) => r.success).length}/{results.length} OK
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {activeUrls.map((url, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                    i < stepIndex
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : i === stepIndex
                      ? "border-accent/30 bg-accent/5"
                      : "border-border/30"
                  }`}
                >
                  {i < stepIndex ? (
                    <CheckCircle size={20} className="text-emerald-400 shrink-0" />
                  ) : i === stepIndex ? (
                    <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border/30" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{url}</p>
                    <p className="text-xs text-muted">
                      {i < stepIndex
                        ? "Hotovo"
                        : i === stepIndex
                        ? "Zpracovávám..."
                        : "Čeká"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && !loading && (
        <>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyAll}
              className="flex items-center gap-2"
            >
              <Copy size={14} />
              {copiedId === "all" ? "Zkopírováno" : "Kopírovat výsledky"}
            </Button>
            <button
              onClick={() => setShowOnlyProblems(!showOnlyProblems)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showOnlyProblems
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-border/50 text-muted hover:bg-card-hover"
              }`}
            >
              {showOnlyProblems ? "Všechny výsledky" : "Pouze problémy"}
            </button>
            <span className="text-xs text-muted ml-auto">
              {results.filter((r) => r.success).length} úspěšných z {results.length}
            </span>
          </div>

          <div className="space-y-4">
            {results
              .filter((r) => !showOnlyProblems || !r.success)
              .map((result, idx) => (
                <ResultCard key={idx} result={result} />
              ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  if (!result.success) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium break-all">{result.url}</p>
              <p className="text-xs text-red-400 mt-1">
                {result.error ?? "Neznámá chyba"}
              </p>
              {result.portal && (
                <Badge variant="secondary" size="sm" className="mt-2">
                  {result.portal}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const a = result.analysis!;
  const l = result.listing!;
  const verdictBadgeVariant = verdictColors[a.verdictLevel] ?? "secondary";

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm leading-snug line-clamp-2 text-foreground">{l.title}</h3>
              <p className="text-xs text-muted mt-1 break-all">{result.url}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant={verdictBadgeVariant as any} size="sm">
                  {verdictLabels[a.verdictLevel]}
                </Badge>
                <Badge variant="score" score={a.investmentScore} size="sm" />
                  {a.condition && (
                    <span className="rounded-lg bg-card-hover border border-border/50 px-2 py-0.5 text-[10px] text-foreground/80">{a.condition}</span>
                  )}
                  <span className="rounded-lg bg-card-hover border border-border/50 px-2 py-0.5 text-[10px] text-foreground/80">{result.portal}</span>
              </div>
            </div>
          </div>

          {/* Image */}
          {l.imageUrls.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-xl">
              <img
                src={l.imageUrls[0]}
                alt={l.title}
                className="h-48 w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <InfoBox label="Cena" value={formatPrice(l.price)} />
            <InfoBox label="ARV" value={formatPrice(a.arv)} />
            <InfoBox
              label="Cena za m²"
              value={
                a.pricePerSqm > 0
                  ? formatPrice(a.pricePerSqm) + "/m²"
                  : "neuvedeno"
              }
            />
            <InfoBox
              label="Trh/m²"
              value={`${formatPrice(a.marketPricePerSqmLow)}–${formatPrice(a.marketPricePerSqmHigh)}`}
            />
            <InfoBox
              label="ROI"
              value={a.roi.toFixed(1) + "%"}
              highlight={a.roi >= 15 ? "text-emerald-400" : a.roi >= 10 ? "text-amber-400" : "text-red-400"}
            />
            <InfoBox label="Čistý zisk" value={formatPrice(a.netProfit)} highlight="text-price" />
            <InfoBox
              label="Podhodnocení"
              value={a.undervaluationPct > 0 ? a.undervaluationPct.toFixed(1) + "%" : "—"}
              highlight={a.undervaluationPct > 0 ? "text-emerald-400" : "text-muted"}
            />
            <InfoBox
              label="Nadhodnocení"
              value={a.overpricingPct > 0 ? a.overpricingPct.toFixed(1) + "%" : "—"}
              highlight={a.overpricingPct > 0 ? "text-amber-400" : "text-muted"}
            />
          </div>

          {/* Location & Meta */}
          <div className="flex flex-wrap gap-2 mb-4">
            {a.location && (
              <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">
                {a.location.city} ({a.location.category})
              </span>
            )}
            {l.area && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{l.area} m²</span>}
            {l.rooms && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{l.rooms}</span>}
            {l.address && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{l.address}</span>}
            {a.buildingType && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{a.buildingType}</span>}
            {a.occupancy && <span className="rounded-lg bg-card-hover border border-border/50 px-2.5 py-1 text-xs text-foreground/80">{a.occupancy}</span>}
          </div>

          {/* Scenarios */}
          {a.scenarios && (
            <div>
              <h2 className="font-semibold tracking-tight text-sm mb-3">Scénáře</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["optimistic", "conservative", "pessimistic"] as const).map((key) => {
                  const s = a.scenarios![key];
                  if (!s) return null;
                  const borderColor = key === "optimistic" ? "border-emerald-500/20 bg-emerald-500/5" : key === "conservative" ? "border-accent/20 bg-accent/5" : "border-red-500/20 bg-red-500/5";
                  return (
                    <div key={key} className={`rounded-xl border ${borderColor} p-3 text-xs space-y-1.5`}>
                      <p className="font-semibold text-[11px] tracking-tight uppercase">{s.label}</p>
                      <div className="flex justify-between">
                        <span className="text-muted">Renovace</span>
                        <span className="font-mono">{formatPrice(s.renovationCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">ARV</span>
                        <span className="font-mono">{formatPrice(s.arv)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Celk. náklady</span>
                        <span className="font-mono">{formatPrice(s.totalCost)}</span>
                      </div>
                      <div className={`flex justify-between font-medium ${
                        s.roi >= 15 ? "text-emerald-400" : s.roi >= 10 ? "text-amber-400" : "text-red-400"
                      }`}>
                        <span>Zisk / ROI</span>
                        <span className="font-mono">{formatPrice(s.netProfit)} / {s.roi}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {a.redFlags.length > 0 && (
            <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4 mb-4">
              <h2 className="font-semibold tracking-tight text-sm text-red-400 mb-3">
                Varovné signály ({a.redFlags.length})
              </h2>
              <div className="space-y-2">
                {a.redFlags.map((rf, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-400/80">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span><span className="font-medium text-red-400">{rf.type}:</span> {rf.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {result.aiSummary && (
            <div className="rounded-xl bg-card-hover border border-border/50 p-4">
              <p className="text-xs text-muted mb-3 font-medium">🤖 AI Hodnocení</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{result.aiSummary}</p>
            </div>
          )}

          {/* Metrics Table */}
          <div className="rounded-xl bg-card-hover border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left text-xs text-muted font-medium px-4 py-2.5">Metrika</th>
                  <th className="text-right text-xs text-muted font-medium px-4 py-2.5">Hodnota</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Cena</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatPrice(l.price)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Cena za m²</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{a.pricePerSqm > 0 ? formatPrice(a.pricePerSqm) + "/m²" : "neuvedeno"}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">ARV</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatPrice(a.arv)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Tržní rozmezí</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatPrice(a.marketPricePerSqmLow)} – {formatPrice(a.marketPricePerSqmHigh)} /m²</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">ROI</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${a.roi >= 15 ? "text-emerald-400" : a.roi >= 10 ? "text-amber-400" : "text-red-400"}`}>{a.roi.toFixed(1)}%</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Čistý zisk</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatPrice(a.netProfit)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Cíl. nákupní cena</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatPrice(a.targetPurchasePrice)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Nutné snížení</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{formatPrice(a.priceReductionNeeded)} ({a.priceReductionPct}%)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Podhodnocení</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${a.undervaluationPct > 0 ? "text-emerald-400" : "text-muted"}`}>{a.undervaluationPct > 0 ? a.undervaluationPct.toFixed(1) + "% ✅" : "—"}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Nadhodnocení</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${a.overpricingPct > 0 ? "text-amber-400" : "text-muted"}`}>{a.overpricingPct > 0 ? a.overpricingPct.toFixed(1) + "% ⚠️" : "—"}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Stav</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{a.condition ?? "nezjištěn"}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-4 py-2.5 text-foreground/80">Lokalita</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{a.location?.city ?? "?"} ({a.location?.category ?? "?"})</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-foreground/80">Typ budovy</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{a.buildingType ?? "?"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Negotiation Tips */}
          {result.aiNegotiationTips && result.aiNegotiationTips.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-2 font-medium">💡 Vyjednávací tipy</p>
              <ul className="space-y-1.5">
                {result.aiNegotiationTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-0.5 shrink-0 text-muted">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Hidden Info */}
          {result.aiHiddenInfo && result.aiHiddenInfo.length > 0 && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
              <p className="text-xs text-amber-400 mb-2 font-medium">🔍 Co ověřit</p>
              <ul className="space-y-1.5">
                {result.aiHiddenInfo.map((info, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-400/80">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span>{info}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comparable Notes */}
          {result.aiComparableNotes && (
            <div className="rounded-xl bg-card-hover border border-border/50 p-4">
              <p className="text-xs text-muted mb-3 font-medium">📋 Srovnání s trhem</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{result.aiComparableNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InfoBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="rounded-xl bg-card-hover border border-border/50 p-3">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-sm font-semibold font-mono ${highlight ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
