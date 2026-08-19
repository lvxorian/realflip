"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  User,
  MagnifyingGlass,
  Calculator,
  Key,
  Bell,
  CreditCard,
  Buildings,
} from "@phosphor-icons/react";

const tabs = [
  { key: "profile", label: "Profil", icon: User },
  { key: "scraping", label: "Scraping", icon: MagnifyingGlass },
  { key: "calculator", label: "Kalkulátor", icon: Calculator },
  { key: "api", label: "API klíče", icon: Key },
  { key: "notifications", label: "Notifikace", icon: Bell },
  { key: "portal", label: "Investorský portál", icon: Buildings },
  { key: "billing", label: "Předplatné", icon: CreditCard },
];

const portals = [
  "Sreality.cz", "Bezrealitky.cz", "RE/MAX", "Century21",
  "Reality.cz", "Annonce", "iDnes Reality", "Hyperreality",
  "MMreality", "Bazos",
];

interface CalcPrefs {
  minRoi: number;
  agentCommission: number;
  legalFees: number;
  contingencyBuffer: number;
  renovationCostPerSqm: { light: number; medium: number; full: number };
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [prefs, setPrefs] = useState<CalcPrefs | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [portalFiftyFifty, setPortalFiftyFifty] = useState(true);
  const [portalNotice, setPortalNotice] = useState("");
  const [portalLoaded, setPortalLoaded] = useState(false);
  const [savingPortal, setSavingPortal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = setTimeout(() => {
      setName(session?.user?.name ?? "");
      setEmail(session?.user?.email ?? "");
    }, 0);
    return () => clearTimeout(timer);
  }, [status, session]);

  useEffect(() => {
    if (status !== "authenticated" || activeTab !== "calculator") return;
    let cancelled = false;
    fetch("/api/settings/preferences")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d === "object" && !d.error) setPrefs(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPrefsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, activeTab]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Uložení se nezdařilo");
        return;
      }
      toast.success("Profil uložen");
      setPassword("");
      router.refresh();
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrefs() {
    if (!prefs) return;
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        toast.error("Uložení se nezdařilo");
        return;
      }
      toast.success("Výchozí hodnoty uloženy");
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSavingPrefs(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated" || activeTab !== "portal") return;
    let cancelled = false;
    fetch("/api/settings/portal")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d === "object" && !d.error) {
          setPortalFiftyFifty(!!d.fiftyFiftyEnabled);
          setPortalNotice(d.fiftyFiftyNotice ?? "");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPortalLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, activeTab]);

  async function savePortal() {
    setSavingPortal(true);
    try {
      const res = await fetch("/api/settings/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiftyFiftyEnabled: portalFiftyFifty, fiftyFiftyNotice: portalNotice }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Uložení se nezdařilo");
        return;
      }
      toast.success("Nastavení portálu uloženo");
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setSavingPortal(false);
    }
  }

  function setPref<K extends keyof CalcPrefs>(key: K, value: CalcPrefs[K]) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (status !== "authenticated") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  const initials = (session.user?.name ?? "??")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="space-y-3 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nastavení</h1>
        <p className="text-sm text-muted mt-1">Spravujte svůj účet a preference</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="lg:w-48 shrink-0 flex lg:flex-col gap-1 p-1 lg:p-0 rounded-xl lg:rounded-none bg-card-hover/70 lg:bg-transparent overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex shrink-0 items-center gap-2.5 px-3 py-2 h-10 rounded-lg text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-card text-foreground shadow-sm lg:bg-accent/10 lg:text-accent lg:shadow-none lg:border lg:border-accent/20"
                    : "text-muted hover:text-foreground lg:hover:bg-card"
                }`}
              >
                <tab.icon size={16} weight={isActive ? "fill" : "regular"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6 space-y-3 sm:space-y-6"
          >
            {activeTab === "profile" && (
              <>
                <h2 className="font-semibold tracking-tight">Profil</h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-accent/10 text-accent text-base sm:text-lg font-mono font-medium">
                    {initials}
                  </div>
                  <div>
                    <p className="font-medium">{session.user?.name ?? "Uživatel"}</p>
                    <p className="text-sm text-muted">{session.user?.email ?? ""}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Jméno" value={name} onChange={(e) => setName(e.target.value)} />
                  <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Nové heslo (volitelné)" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} helper="Minimálně 8 znaků" />
                </div>
                <Button size="sm" onClick={saveProfile} loading={savingProfile}>
                  {savingProfile ? "Ukládám..." : "Uložit změny"}
                </Button>
              </>
            )}

            {activeTab === "scraping" && (
              <>
                <h2 className="font-semibold tracking-tight">Povolené portály</h2>
                <p className="text-xs text-muted -mt-4">Všechna hledání prohledávají tyto portály.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {portals.map((p) => (
                    <label key={p} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 hover:bg-card-hover transition-colors cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-border text-accent focus:ring-accent/20" />
                      <span className="text-sm">{p}</span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Výchozí plán pro nová hledání</label>
                  <select className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-accent/50">
                    <option value="manual">Ručně</option>
                    <option value="daily">Denně</option>
                    <option value="weekly">Týdně</option>
                  </select>
                  <p className="text-xs text-muted">Každé hledání může mít vlastní plán při vytváření. Toto je výchozí hodnota.</p>
                </div>
                <hr className="border-border/50" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold tracking-tight text-sm">Vaše hledání</h3>
                    <p className="text-xs text-muted mt-0.5">Spravujte jednotlivá hledání a jejich plánování.</p>
                  </div>
                  <Link
                    href="/searches"
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    Spravovat hledání
                  </Link>
                </div>
              </>
            )}

            {activeTab === "calculator" && (
              <>
                <h2 className="font-semibold tracking-tight">Výchozí hodnoty kalkulačky</h2>
                <p className="text-xs text-muted -mt-4">Tyto hodnoty ovlivňují výpočet flipu (analyzátor, kalkulačka, reporty).</p>
                {!prefs && !prefsLoaded ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                ) : !prefs ? (
                  <p className="text-sm text-muted">Nepodařilo se načíst výchozí hodnoty.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Cílové ROI (%)" type="number" step={0.1} value={prefs.minRoi.toString()} onChange={(e) => setPref("minRoi", parseFloat(e.target.value) || 0)} />
                      <Input label="Provize makléře (%)" type="number" value={prefs.agentCommission.toString()} onChange={(e) => setPref("agentCommission", parseInt(e.target.value) || 0)} helper="Použito jako provize při prodeji" />
                      <Input label="Právní služby (Kč)" type="amount" value={prefs.legalFees.toString()} onChange={(e) => setPref("legalFees", parseInt(e.target.value) || 0)} />
                      <Input label="Rezerva (%)" type="number" value={prefs.contingencyBuffer.toString()} onChange={(e) => setPref("contingencyBuffer", parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground/80 block mb-3">Náklady na rekonstrukci</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input label="Lehká" type="amount" value={prefs.renovationCostPerSqm.light.toString()} onChange={(e) => setPref("renovationCostPerSqm", { ...prefs.renovationCostPerSqm, light: parseInt(e.target.value) || 0 })} helper="Kč/m²" />
                        <Input label="Střední" type="amount" value={prefs.renovationCostPerSqm.medium.toString()} onChange={(e) => setPref("renovationCostPerSqm", { ...prefs.renovationCostPerSqm, medium: parseInt(e.target.value) || 0 })} helper="Kč/m²" />
                        <Input label="Kompletní" type="amount" value={prefs.renovationCostPerSqm.full.toString()} onChange={(e) => setPref("renovationCostPerSqm", { ...prefs.renovationCostPerSqm, full: parseInt(e.target.value) || 0 })} helper="Kč/m²" />
                      </div>
                    </div>
                    <Button size="sm" onClick={savePrefs} loading={savingPrefs}>
                      {savingPrefs ? "Ukládám..." : "Uložit výchozí hodnoty"}
                    </Button>
                  </>
                )}
              </>
            )}

            {activeTab === "api" && (
              <>
                <h2 className="font-semibold tracking-tight">API klíče</h2>
                <p className="text-xs text-muted -mt-4">Klíče se nastavují přes environment proměnné serveru (neukládají se do databáze).</p>
                <div className="space-y-3">
                  {[
                    { label: "Gemini API klíč", key: "GEMINI_API_KEY", hint: "Pro AI analýzu inzerátů a lokalitní dohled" },
                    { label: "OpenAI API klíč", key: "OPENAI_API_KEY", hint: "Volitelný — aktuálně se používá Gemini" },
                    { label: "Mapbox token", key: "MAPBOX_TOKEN", hint: "Volitelný — mapy běží na OpenStreetMap" },
                  ].map((k) => (
                    <div key={k.key} className="rounded-lg border border-border/50 p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{k.label}</p>
                        <code className="text-[10px] text-muted font-mono break-all">{k.key}</code>
                      </div>
                      <p className="text-xs text-muted mt-1">{k.hint}</p>
                    </div>
                  ))}
                </div>
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
                    <div key={n.label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/50 p-3 sm:p-4">
                      <div>
                        <p className="text-sm font-medium">{n.label}</p>
                        <p className="text-xs text-muted">{n.desc}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {["Email", "Push", "SMS"].map((ch) => (
                          <label key={ch} className="flex items-center gap-1.5 text-xs text-muted">
                            <input type="checkbox" defaultChecked={ch === "Push"} className="rounded border-border text-accent h-4 w-4" />
                            {ch}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted">Preference notifikací zatím nejsou ukládané — alerty se zobrazují v aplikaci.</p>
              </>
            )}

            {activeTab === "portal" && (
              <>
                <h2 className="font-semibold tracking-tight">Investorský portál</h2>
                <p className="text-xs text-muted -mt-4">
                  Nastavení modelu spolupráce 50/50 napříč celým portálem pro investory.
                </p>
                {!portalLoaded ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 p-3 sm:p-4">
                      <div>
                        <p className="text-sm font-medium">Model 50/50 je k dispozici</p>
                        <p className="text-xs text-muted mt-1">
                          Když je vypnuté, nabídky s 50/50 se v portálu skryjí a investorům se zobrazí
                          hlášení. Sourcing fee běží dál.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPortalFiftyFifty((v) => !v)}
                        aria-pressed={portalFiftyFifty}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                          portalFiftyFifty ? "bg-accent" : "bg-border"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                            portalFiftyFifty ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground/80">Hlášení investorům při pozastavení 50/50</label>
                      <textarea
                        value={portalNotice}
                        onChange={(e) => setPortalNotice(e.target.value)}
                        rows={3}
                        placeholder="Naše specializovaná řemeslnická parta aktuálně pracuje na jiném projektu — model 50/50 je dočasně pozastaven."
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-accent/50 transition-colors"
                      />
                      <p className="text-xs text-muted">Prázdné pole použije výchozí hlášení.</p>
                    </div>
                    <Button size="sm" onClick={savePortal} loading={savingPortal}>
                      {savingPortal ? "Ukládám..." : "Uložit nastavení portálu"}
                    </Button>
                  </>
                )}
              </>
            )}

            {activeTab === "billing" && (
              <>
                <h2 className="font-semibold tracking-tight">Předplatné</h2>
                <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6">
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
                      <span className="font-mono">—</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-border/50 overflow-hidden">
                      <div className="h-full w-[0%] rounded-full bg-accent" />
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
                  <Button variant="default" onClick={() => toast.info("Upgrade na Pro bude brzy k dispozici")}>
                    Upgrade na Pro
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
