"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Key,
  PaintBucket,
  Sliders,
  Save,
  Globe,
} from "lucide-react";

type SettingsTab = "profile" | "scraping" | "calculator" | "api" | "notifications" | "billing";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: "profile", label: "Profil", icon: User },
    { key: "scraping", label: "Scraping", icon: Globe },
    { key: "calculator", label: "Kalkulátor", icon: PaintBucket },
    { key: "api", label: "API klíče", icon: Key },
    { key: "notifications", label: "Notifikace", icon: Bell },
    { key: "billing", label: "Předplatné", icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nastavení</h1>
        <p className="text-muted text-sm mt-1">Správa účtu a konfigurace aplikace</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 space-y-1 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-muted hover:bg-card-hover hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {activeTab === "profile" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base">Osobní údaje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 border border-accent/30 text-xl font-bold text-accent">
                      JN
                    </div>
                    <Button variant="outline" size="sm">
                      Změnit avatar
                    </Button>
                  </div>
                  <Input label="Jméno" defaultValue="Jan Novák" />
                  <Input label="Email" type="email" defaultValue="jan@realflip.cz" />
                  <Input label="Telefon" defaultValue="+420 777 123 456" />
                  <Button variant="glass">
                    <Save size={14} />
                    Uložit změny
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "scraping" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base">Portály</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-w-lg">
                  {[
                    "sreality.cz",
                    "bezrealitky.cz",
                    "bazos.cz",
                    "annonce.cz",
                    "reality.cz",
                    "hyperreality.cz",
                    "remax.cz",
                    "century21.cz",
                    "idnes.cz/reality",
                    "mmreality.cz",
                  ].map((portal) => (
                    <div key={portal} className="flex items-center justify-between py-2">
                      <span className="text-sm">{portal}</span>
                      <Badge variant="success">Aktivní</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base">Interval scrapingu</CardTitle>
                </CardHeader>
                <CardContent className="max-w-lg">
                  <div className="flex gap-2">
                    {["Každou hodinu", "Každé 3h", "Každých 6h", "Denně"].map((interval) => (
                      <button
                        key={interval}
                        className={`flex-1 py-2 text-xs rounded-lg border transition-all ${
                          interval === "Každých 6h"
                            ? "border-accent bg-accent/20 text-accent"
                            : "border-border text-muted hover:border-accent/30"
                        }`}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "calculator" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base">Výchozí hodnoty kalkulátoru</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-lg">
                  <Input label="Provize RK (%)" type="number" defaultValue="4" />
                  <Input label="Daň z nabytí (%)" type="number" defaultValue="4" />
                  <Input label="Právní poplatky (%)" type="number" defaultValue="4" />
                  <Input label="Rezerva (%)" type="number" defaultValue="10" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Náklady na rekonstrukci (Kč/m²)</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Input label="Lehká" type="number" defaultValue="8000" />
                      <Input label="Střední" type="number" defaultValue="12000" />
                      <Input label="Kompletní" type="number" defaultValue="18000" />
                    </div>
                  </div>
                  <Button variant="glass">
                    <Save size={14} />
                    Uložit výchozí hodnoty
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "api" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base">API klíče</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-lg">
                  <Input label="OpenAI API klíč" type="password" placeholder="sk-..." />
                  <Input label="Mapbox token" type="password" placeholder="pk...." />
                  <Button variant="glass">
                    <Save size={14} />
                    Uložit klíče
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base">Notifikace</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-w-lg">
                  {[
                    "Nové nemovitosti dle kritérií",
                    "Snížení ceny sledované nemovitosti",
                    "Denní digest nových příležitostí",
                    "Výsledek scrapovacího jobu",
                  ].map((opt) => (
                    <div key={opt} className="flex items-center justify-between py-2">
                      <span className="text-sm">{opt}</span>
                      <div className="flex gap-1">
                        {["Email", "Push", "SMS"].map((ch) => (
                          <button
                            key={ch}
                            className={`px-2 py-1 text-[10px] rounded-md border transition-all ${
                              ch === "Email"
                                ? "border-accent bg-accent/20 text-accent"
                                : "border-border text-muted hover:border-accent/30"
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === "billing" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card glass>
                <CardHeader>
                  <CardTitle className="text-base">Předplatné</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-lg">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-card-hover">
                    <div>
                      <p className="font-semibold">Free plán</p>
                      <p className="text-xs text-muted">500 scrapingů / měsíc</p>
                    </div>
                    <Badge variant="success">Aktivní</Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted">Využití tento měsíc:</p>
                    <div className="h-2 rounded-full bg-card-hover overflow-hidden">
                      <div className="h-full w-[23%] rounded-full bg-gradient-to-r from-accent to-secondary" />
                    </div>
                    <p className="text-xs text-muted">47 / 500 scrapingů (9%)</p>
                  </div>
                  <Button variant="outline" size="sm">Upgradovat na Pro</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
