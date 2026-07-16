"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import InteractiveAnalysis from "@/components/calculator/interactive-analysis";
import { MagnifyingGlass, CheckCircle, Copy, Trash } from "@phosphor-icons/react";

interface AnalysisResult {
  url: string;
  portal: string;
  success: boolean;
  error?: string;
  listing?: {
    title: string;
    price: number;
    area: number | null;
    rooms: string | null;
    condition: string | null;
    address: string | null;
    description: string | null;
    imageUrls: string[];
    contactPhone: string | null;
    contactName: string | null;
    contactEmail: string | null;
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
    redFlags: { type: string; text: string; severity: string }[];
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
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
            `  ${a.verdictLevel} | Skóre: ${a.investmentScore} | ROI: ${a.roi.toFixed(1)}% | Zisk: ${formatPrice(a.netProfit)}`
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
                <InteractiveAnalysis key={idx} result={result} index={idx} />
              ))}
          </div>
        </>
      )}
    </motion.div>
  );
}


