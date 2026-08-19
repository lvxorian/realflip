"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import ValuationInput from "@/components/valuation/valuation-input";
import ValuationResultView from "@/components/valuation/valuation-result";
import type {
  ValuationAiCorrection,
  ValuationAiOutput,
  ValuationInput as ValuationFields,
  ValuationResult,
} from "@/lib/valuation/types";

const STEPS = ["Vstup", "Údaje", "Výsledek"];

function OdhadPageContent() {
  const { status } = useSession();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [fields, setFields] = useState<ValuationFields>({
    cityKey: "",
    type: "flat",
    area: null,
  });
  const [parsed, setParsed] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [ai, setAi] = useState<ValuationAiOutput | null>(null);
  const [aiCorrection, setAiCorrection] = useState<ValuationAiCorrection | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const stepIndex = result ? 2 : parsed ? 1 : 0;

  // URL držíme i v refu — handleParseUrl je stabilní (deps []), aby se při setUrl
  // nezměnila jeho identita a effect na to nereagoval (předtím cleanup zrušil
  // naplánované auto-načtení → „URL se přidá, ale nic se nestane").
  const urlRef = useRef("");
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const handleParseUrl = useCallback(async (urlToParse?: string) => {
    const target = (urlToParse ?? urlRef.current ?? "").trim();
    if (!target) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Načtení inzerátu selhalo");
        return;
      }
      const p = data.parsed ?? {};
      setFields((prev) => ({ ...prev, ...p }));
      setParsed(true);
    } catch {
      setError("Načtení inzerátu selhalo — zkuste to prosím znovu.");
    } finally {
      setParsing(false);
    }
  }, []);

  // Podpora /odhad?url=… — předvyplní URL a automaticky načte inzerát (odkaz z detailu/Analyzátoru).
  // Volá se okamžitě (bez timeoutu, který by mohl cleanup zrušit). Guard srovnává poslední
  // zpracovanou URL — chrání před double-fire v StrictMode, ale novou ?url= (zpět/vpřed,
  // klik z jiného detailu) znovu načte. Spouští se až po ověření session (jinak API vrátí 401).
  const searchParams = useSearchParams();
  const autoParsedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "authenticated") return;
    const qUrl = searchParams.get("url");
    if (!qUrl || autoParsedUrlRef.current === qUrl) return;
    autoParsedUrlRef.current = qUrl;
    setUrl(qUrl);
    void handleParseUrl(qUrl);
  }, [searchParams, status, handleParseUrl]);

  const handleEstimate = async () => {
    if (!fields.cityKey || !fields.area) return;
    setEstimating(true);
    setError(null);
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Výpočet odhadu selhal");
        return;
      }
      setResult(data.valuation);
      setAi(data.ai ?? null);
      setAiCorrection(data.aiCorrection ?? null);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      setError("Výpočet odhadu selhal — zkuste to prosím znovu.");
    } finally {
      setEstimating(false);
    }
  };

  const handlePrintReport = () => {
    if (!result) return;
    try {
      sessionStorage.setItem(
        "valuation-report",
        JSON.stringify({ valuation: result, fields, ai, aiCorrection })
      );
      window.open("/report/valuation", "_blank");
    } catch {
      toast.error("Report se nepodařilo otevřít");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Odhad ceny bytu</h1>
        <p className="text-sm text-muted mt-1">
          Odhad je určen pro bytové jednotky. Kombinuje realizované prodeje (Seznam cenová mapa / ČÚZK), ČSÚ statistiky
          a nabídkové ceny z vlastní databáze. Výsledkem je rozmezí se spolehlivostí — ne magické číslo.
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors ${
                i <= stepIndex
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-border/50 text-muted"
              }`}
            >
              <span className="font-mono">{i + 1}</span>
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      <ValuationInput
        fields={fields}
        setFields={setFields}
        url={url}
        setUrl={setUrl}
        parsing={parsing}
        estimating={estimating}
        error={error}
        parsed={parsed}
        onParseUrl={handleParseUrl}
        onEstimate={handleEstimate}
      />

      {result && (
        <div ref={resultRef} className="scroll-mt-6">
          <ValuationResultView
            result={result}
            ai={ai}
            aiCorrection={aiCorrection}
            fields={fields}
            onPrintReport={handlePrintReport}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function OdhadPage() {
  return (
    <Suspense fallback={null}>
      <OdhadPageContent />
    </Suspense>
  );
}
