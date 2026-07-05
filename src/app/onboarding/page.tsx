"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { House, ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";

const steps = ["Profil", "Lokality", "Rozpočet"];

const experiences = [
  { id: "beginner", label: "Začátečník", desc: "Nový v realitních investicích" },
  { id: "intermediate", label: "Pokročilý", desc: "Mám 1–3 flipy za sebou" },
  { id: "pro", label: "Profesionál", desc: "Více než 5 flipů" },
];

const strategies = [
  { id: "quick", label: "Rychlý flip", desc: "Koupit, renovovat, prodat do 6 měsíců" },
  { id: "mid", label: "Střednědobý", desc: "Držet 1–3 roky s renovací" },
  { id: "long", label: "Dlouhodobý", desc: "Pronájem a čekání na zhodnocení" },
  { id: "hold", label: "Koupě a držení", desc: "Dlouhodobý pronájem bez renovace" },
];

const localities = [
  "Praha", "Brno", "Ostrava", "Plzeň", "Liberec",
  "Olomouc", "Č. Budějovice", "Hradec Králové",
  "Ústí n. Labem", "Pardubice", "Zlín", "Jihlava",
];

const propertyTypes = [
  "Byt", "Rodinný dům", "Cihlový dům",
  "Pozemek", "Kancelář", "Objekt k demolici",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedExperience, setSelectedExperience] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [selectedLocalities, setSelectedLocalities] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [minRoi, setMinRoi] = useState("15");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  function toggleLocality(loc: string) {
    setSelectedLocalities((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  function toggleType(t: string) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function complete() {
    setLoading(true);
    try {
      await fetch("/api/settings/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLocalities: selectedLocalities,
          budgetMin: budgetMin ? Number(budgetMin) : null,
          budgetMax: budgetMax ? Number(budgetMax) : null,
          minRoi: Number(minRoi),
          propertyTypes: selectedTypes,
        }),
      });
      router.push("/dashboard");
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh]">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/3 relative overflow-hidden bg-gradient-to-br from-accent/20 via-background to-emerald-500/10 items-center justify-center p-8">
        <div className="absolute inset-0 property-image-shimmer opacity-30" />
        <div className="relative text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/20 border border-accent/30">
            <House size={32} weight="fill" className="text-accent" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight mb-2">Nastavení profilu</h2>
          <p className="text-sm text-muted leading-relaxed">
            Pomůže nám to přizpůsobit dashboard vašim investičním cílům
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-center justify-center p-6 bg-grid">
        <div className="w-full max-w-lg">
          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all ${
                  i <= step ? "bg-accent text-white" : "bg-card text-muted border border-border/50"
                }`}>
                  {i < step ? <Check size={12} weight="bold" /> : i + 1}
                </div>
                <span className={`text-xs ${i <= step ? "text-foreground" : "text-muted"} hidden sm:block`}>{s}</span>
                {i < steps.length - 1 && <div className="w-6 h-px bg-border/50" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring" as const, stiffness: 100, damping: 20 }}
              className="rounded-[2.5rem] border border-border/50 bg-card p-8"
            >
              {step === 0 && (
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-semibold tracking-tight">Vítejte v RealFlip</h2>
                    <p className="text-sm text-muted mt-1">Nejprve pár otázek pro lepší nastavení</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground/80 block mb-3">Zkušenosti</label>
                    <div className="grid grid-cols-1 gap-2">
                      {experiences.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setSelectedExperience(e.id)}
                          className={`text-left p-4 rounded-xl border transition-all ${
                            selectedExperience === e.id
                              ? "border-accent/50 bg-accent/5"
                              : "border-border/50 hover:bg-card-hover"
                          }`}
                        >
                          <p className="text-sm font-medium">{e.label}</p>
                          <p className="text-xs text-muted">{e.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground/80 block mb-3">Strategie</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {strategies.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStrategy(s.id)}
                          className={`text-left p-4 rounded-xl border transition-all ${
                            selectedStrategy === s.id
                              ? "border-accent/50 bg-accent/5"
                              : "border-border/50 hover:bg-card-hover"
                          }`}
                        >
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-semibold tracking-tight">Cílové lokality</h2>
                    <p className="text-sm text-muted mt-1">Vyberte města, která vás zajímají</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {localities.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => toggleLocality(loc)}
                        className={`p-3 rounded-xl border text-sm text-center transition-all ${
                          selectedLocalities.includes(loc)
                            ? "border-accent/50 bg-accent/5 text-accent"
                            : "border-border/50 hover:bg-card-hover text-muted"
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-semibold tracking-tight">Rozpočet a parametry</h2>
                    <p className="text-sm text-muted mt-1">Nastavte si investiční limity</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Min. rozpočet" type="number" placeholder="2 000 000" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                    <Input label="Max. rozpočet" type="number" placeholder="15 000 000" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                  </div>

                  <Input label="Minimální ROI" type="number" helper="%" value={minRoi} onChange={(e) => setMinRoi(e.target.value)} />

                  <div>
                    <label className="text-sm font-medium text-foreground/80 block mb-3">Typy nemovitostí</label>
                    <div className="grid grid-cols-2 gap-2">
                      {propertyTypes.map((t) => (
                        <button
                          key={t}
                          onClick={() => toggleType(t)}
                          className={`p-3 rounded-xl border text-sm transition-all ${
                            selectedTypes.includes(t)
                              ? "border-accent/50 bg-accent/5 text-accent"
                              : "border-border/50 hover:bg-card-hover text-muted"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/30">
                <button
                  onClick={() => step > 0 && setStep(step - 1)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    step > 0 ? "text-muted hover:text-foreground" : "text-transparent pointer-events-none"
                  }`}
                >
                  <ArrowLeft size={14} weight="bold" />
                  Zpět
                </button>

                {step < steps.length - 1 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    className="gap-1.5"
                  >
                    Pokračovat
                    <ArrowRight size={14} weight="bold" />
                  </Button>
                ) : (
                  <Button
                    onClick={complete}
                    loading={loading}
                    className="gap-1.5"
                  >
                    Dokončit
                    <Check size={14} weight="bold" />
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
