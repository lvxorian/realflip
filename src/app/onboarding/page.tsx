"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ArrowRight, ArrowLeft, MapPin, DollarSign, Target } from "lucide-react";

const steps = [
  { title: "Investiční profil", subtitle: "Jaký typ investor jste?", icon: Target },
  { title: "Cílové lokality", subtitle: "Kde hledáte příležitosti?", icon: MapPin },
  { title: "Rozpočet a cíle", subtitle: "Jaký je váš investiční horizont?", icon: DollarSign },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    experience: "",
    strategy: "",
    targetLocalities: [] as string[],
    budgetMin: 2000000,
    budgetMax: 10000000,
    minRoi: 15,
    propertyTypes: [] as string[],
  });

  const updateProfile = (key: string, value: any) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key: "targetLocalities" | "propertyTypes", item: string) => {
    setProfile((prev) => ({
      ...prev,
      [key]: prev[key].includes(item)
        ? prev[key].filter((i) => i !== item)
        : [...prev[key], item],
    }));
  };

  async function handleComplete() {
    // Save preferences to DB
    const res = await fetch("/api/settings/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (res.ok) {
      router.push("/dashboard");
    }
  }

  const canProceed = () => {
    if (step === 0) return profile.experience !== "" && profile.strategy !== "";
    if (step === 1) return profile.targetLocalities.length > 0;
    return true;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-grid p-4">
      <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-secondary/5 pointer-events-none" />

      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map((s, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                  idx < step
                    ? "bg-success/20 border-success/30 text-success"
                    : idx === step
                      ? "bg-accent/20 border-accent/30 text-accent"
                      : "bg-card border-border text-muted"
                }`}
              >
                {idx < step ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <s.icon size={18} />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 w-12 transition-colors ${
                    idx < step ? "bg-accent" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Card glass borderGradient>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{steps[step].title}</CardTitle>
            <CardDescription>{steps[step].subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {step === 0 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium mb-3">Zkušenosti s flipováním</p>
                      <div className="grid grid-cols-3 gap-2">
                        {["Začátečník", "Pokročilý", "Profesionál"].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => updateProfile("experience", opt)}
                            className={`p-3 rounded-lg border text-sm transition-all ${
                              profile.experience === opt
                                ? "border-accent bg-accent/20 text-accent"
                                : "border-border text-muted hover:border-accent/30"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-3">Preferovaná strategie</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: "quick", label: "Rychlý flip", desc: "Do 6 měsíců" },
                          { key: "medium", label: "Střednědobý", desc: "6–12 měsíců" },
                          { key: "long", label: "Dlouhodobý", desc: "12+ měsíců" },
                          { key: "buy_hold", label: "Koupě a držení", desc: "Nájem +升值" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => updateProfile("strategy", opt.key)}
                            className={`p-3 rounded-lg border text-sm transition-all ${
                              profile.strategy === opt.key
                                ? "border-accent bg-accent/20 text-accent"
                                : "border-border text-muted hover:border-accent/30"
                            }`}
                          >
                            <p className="font-medium">{opt.label}</p>
                            <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    <p className="text-sm font-medium mb-3">Kde hledáte nemovitosti?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        "Praha",
                        "Brno",
                        "Ostrava",
                        "Plzeň",
                        "Liberec",
                        "Olomouc",
                        "České Budějovice",
                        "Hradec Králové",
                        "Pardubice",
                        "Ústí nad Labem",
                        "Zlín",
                        "Celá Česká republika",
                      ].map((city) => (
                        <button
                          key={city}
                          onClick={() => toggleArrayItem("targetLocalities", city)}
                          className={`p-3 rounded-lg border text-sm transition-all ${
                            profile.targetLocalities.includes(city)
                              ? "border-accent bg-accent/20 text-accent"
                              : "border-border text-muted hover:border-accent/30"
                          }`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Minimální rozpočet"
                        type="number"
                        value={profile.budgetMin}
                        onChange={(e) => updateProfile("budgetMin", Number(e.target.value))}
                      />
                      <Input
                        label="Maximální rozpočet"
                        type="number"
                        value={profile.budgetMax}
                        onChange={(e) => updateProfile("budgetMax", Number(e.target.value))}
                      />
                    </div>
                    <Input
                      label="Minimální ROI (%)"
                      type="number"
                      value={profile.minRoi}
                      onChange={(e) => updateProfile("minRoi", Number(e.target.value))}
                    />
                    <div>
                      <p className="text-sm font-medium mb-3">Typy nemovitostí</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "Byt",
                          "Rodinný dům",
                          "Činžovní dům",
                          "Rekreační objekt",
                          "Komerční",
                          "Pozemek",
                        ].map((type) => (
                          <button
                            key={type}
                            onClick={() => toggleArrayItem("propertyTypes", type)}
                            className={`p-3 rounded-lg border text-sm transition-all ${
                              profile.propertyTypes.includes(type)
                                ? "border-accent bg-accent/20 text-accent"
                                : "border-border text-muted hover:border-accent/30"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => step > 0 && setStep(step - 1)}
                disabled={step === 0}
              >
                <ArrowLeft size={16} />
                Zpět
              </Button>

              {step < 2 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  Pokračovat
                  <ArrowRight size={16} />
                </Button>
              ) : (
                <Button onClick={handleComplete} variant="secondary">
                  <CheckCircle2 size={16} />
                  Dokončit nastavení
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
