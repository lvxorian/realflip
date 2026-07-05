"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  MagnifyingGlass,
  Calculator,
  Key,
  Bell,
  CreditCard,
} from "@phosphor-icons/react";

const tabs = [
  { key: "profile", label: "Profil", icon: User },
  { key: "scraping", label: "Scraping", icon: MagnifyingGlass },
  { key: "calculator", label: "Kalkulátor", icon: Calculator },
  { key: "api", label: "API klíče", icon: Key },
  { key: "notifications", label: "Notifikace", icon: Bell },
  { key: "billing", label: "Předplatné", icon: CreditCard },
];

const portals = [
  "Sreality.cz", "Bezrealitky.cz", "RE/MAX", "Century21",
  "Reality.cz", "Annonce", "iDnes Reality", "Hyperreality",
  "MMreality", "Bazos",
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nastavení</h1>
        <p className="text-sm text-muted mt-1">Spravujte svůj účet a preference</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tab sidebar */}
        <div className="lg:w-48 shrink-0 flex lg:flex-col gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-muted hover:text-foreground hover:bg-card"
                }`}
              >
                <tab.icon size={16} weight={isActive ? "fill" : "regular"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-border/50 bg-card p-6 space-y-6"
          >
            {activeTab === "profile" && (
              <>
                <h2 className="font-semibold tracking-tight">Profil</h2>
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent text-lg font-mono font-medium">
                    CA
                  </div>
                  <div>
                    <p className="font-medium">Cakmak</p>
                    <p className="text-sm text-muted">cakmak@tuta.com</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Jméno" defaultValue="Cakmak" />
                  <Input label="Email" defaultValue="cakmak@tuta.com" />
                  <Input label="Telefon" placeholder="+420 ..." />
                </div>
                <Button size="sm">Uložit změny</Button>
              </>
            )}

            {activeTab === "scraping" && (
              <>
                <h2 className="font-semibold tracking-tight">Sledované portály</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {portals.map((p) => (
                    <label key={p} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 hover:bg-card-hover transition-colors cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-border text-accent focus:ring-accent/20" />
                      <span className="text-sm">{p}</span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Interval scrapování</label>
                  <select className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-accent/50">
                    <option>Každou hodinu</option>
                    <option>Každé 3 hodiny</option>
                    <option>Každých 6 hodin</option>
                    <option selected>Denně</option>
                  </select>
                </div>
              </>
            )}

            {activeTab === "calculator" && (
              <>
                <h2 className="font-semibold tracking-tight">Výchozí hodnoty kalkulačky</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Provize makléře" type="number" defaultValue="4" helper="%" />
                  <Input label="Daň z převodu" type="number" defaultValue="4" helper="%" />
                  <Input label="Právní služby" type="number" defaultValue="4" helper="%" />
                  <Input label="Rezerva" type="number" defaultValue="10" helper="%" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground/80 block mb-3">Náklady na rekonstrukci</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input label="Lehká" type="number" defaultValue="8000" helper="Kč/m²" />
                    <Input label="Střední" type="number" defaultValue="12000" helper="Kč/m²" />
                    <Input label="Kompletní" type="number" defaultValue="18000" helper="Kč/m²" />
                  </div>
                </div>
              </>
            )}

            {activeTab === "api" && (
              <>
                <h2 className="font-semibold tracking-tight">API klíče</h2>
                <Input label="OpenAI API klíč" type="password" placeholder="sk-..." helper="Pro AI analýzu inzerátů" />
                <Input label="Mapbox token" type="password" placeholder="pk...." helper="Pro mapové podklady" />
                <Button size="sm">Uložit klíče</Button>
              </>
            )}

            {activeTab === "notifications" && (
              <>
                <h2 className="font-semibold tracking-tight">Notifikace</h2>
                <div className="space-y-3">
                  {[
                    { label: "Nový podhodnocený inzerát", desc: "Když AI najde skóre 80+" },
                    { label: "Cenový drop", desc: "Snížení ceny o více než 10 %" },
                    { label: "Dokončení scrapování", desc: "Po každém scrapování portálů" },
                    { label: "Týdenní report", desc: "Souhrn aktivit za týden" },
                  ].map((n) => (
                    <div key={n.label} className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                      <div>
                        <p className="text-sm font-medium">{n.label}</p>
                        <p className="text-xs text-muted">{n.desc}</p>
                      </div>
                      <div className="flex gap-2">
                        {["Email", "Push", "SMS"].map((ch) => (
                          <label key={ch} className="flex items-center gap-1.5 text-xs text-muted">
                            <input type="checkbox" defaultChecked={ch === "Push"} className="rounded border-border text-accent" />
                            {ch}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "billing" && (
              <>
                <h2 className="font-semibold tracking-tight">Předplatné</h2>
                <div className="rounded-2xl border border-border/50 bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-lg font-semibold">Free</p>
                      <p className="text-sm text-muted">0 Kč / měsíc</p>
                    </div>
                    <Badge variant="default" size="md">Aktivní</Badge>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted">Využití scrapování</span>
                      <span className="font-mono">47 / 500</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-border/50 overflow-hidden">
                      <div className="h-full w-[9.4%] rounded-full bg-accent" />
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 text-sm">
                    {["500 inzerátů / měsíc", "10 portálů", "AI analýza", "Pipeline management"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-muted">
                        <span className="text-accent">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant="default">Upgrade na Pro</Button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
