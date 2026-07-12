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
  aiReport?: string | null;
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
      className="mx-auto max-w-4xl space-y-8 p-6"
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

      <Card glass>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                placeholder="Vložte URL inzerátů (každou na nový řádek, max 10)"
                rows={5}
                className="w-full resize-none rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
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
        <Card glass>
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
      <Card glass>
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
      <Card glass>
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm leading-snug line-clamp-2">{l.title}</h3>
              <p className="text-xs text-muted mt-1 break-all">{result.url}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={verdictBadgeVariant as any} size="sm">
                  {verdictLabels[a.verdictLevel]}
                </Badge>
                <Badge variant="score" score={a.investmentScore} size="sm" />
                {a.condition && (
                  <Badge variant="secondary" size="sm">{a.condition}</Badge>
                )}
                <Badge variant="secondary" size="sm">{result.portal}</Badge>
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
            <InfoBox label="Čistý zisk" value={formatPrice(a.netProfit)} />
            <InfoBox
              label="Podhodnocení"
              value={a.undervaluationPct > 0 ? a.undervaluationPct.toFixed(1) + "%" : "—"}
              highlight={a.undervaluationPct > 0 ? "text-emerald-400" : undefined}
            />
            <InfoBox
              label="Nadhodnocení"
              value={a.overpricingPct > 0 ? a.overpricingPct.toFixed(1) + "%" : "—"}
              highlight={a.overpricingPct > 0 ? "text-amber-400" : undefined}
            />
          </div>

          {/* Location & Meta */}
          <div className="flex flex-wrap gap-2 mb-4">
            {a.location && (
              <Badge variant="info" size="sm">
                {a.location.city} ({a.location.category})
              </Badge>
            )}
            {l.area && <Badge variant="info" size="sm">{l.area} m²</Badge>}
            {l.rooms && <Badge variant="info" size="sm">{l.rooms}</Badge>}
            {l.address && <Badge variant="info" size="sm">{l.address}</Badge>}
            {a.buildingType && <Badge variant="secondary" size="sm">{a.buildingType}</Badge>}
            {a.occupancy && <Badge variant="secondary" size="sm">{a.occupancy}</Badge>}
          </div>

          {/* Scenarios */}
          {a.scenarios && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted mb-2">Scénáře</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["optimistic", "conservative", "pessimistic"] as const).map((key) => {
                  const s = a.scenarios![key];
                  if (!s) return null;
                  return (
                    <div key={key} className="rounded-xl border border-border/30 bg-card/50 p-3">
                      <p className="text-xs font-medium mb-1">{s.label}</p>
                      <p className="text-xs text-muted">
                        Renovace: {formatPrice(s.renovationCost)}
                      </p>
                      <p className={`text-xs font-medium ${
                        s.roi >= 15 ? "text-emerald-400" : s.roi >= 10 ? "text-amber-400" : "text-red-400"
                      }`}>
                        Zisk: {formatPrice(s.netProfit)} | ROI: {s.roi}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {a.redFlags.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-red-400 mb-2">
                Varovné signály ({a.redFlags.length})
              </p>
              <div className="space-y-1">
                {a.redFlags.map((rf, i) => (
                  <p key={i} className="text-xs text-red-400/80">
                    • <span className="font-medium">{rf.type}:</span> {rf.description}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* AI Report */}
          {result.aiReport && (
            <div className="rounded-xl border border-border/30 bg-card/50 p-4">
              <p className="text-xs font-medium text-muted mb-2">🤖 AI Hodnocení</p>
              <div
                className="prose prose-invert prose-xs max-w-none text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_table]:w-full [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-xs [&_th]:text-muted [&_table]:text-xs [&_tr]:border-b [&_tr]:border-border/20"
                dangerouslySetInnerHTML={{
                  __html: result.aiReport
                    .replace(/\n/g, "<br>")
                    .replace(/\|/g, "")
                    .replace(/<br>\s*<br>/g, "<br>"),
                }}
              />
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
    <div className="rounded-xl border border-border/30 bg-card/50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className={`text-sm font-medium ${highlight ?? ""}`}>{value}</p>
    </div>
  );
}
