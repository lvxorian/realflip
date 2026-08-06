"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MagnifyingGlass,
  HandCoins,
  Pulse,
  LockSimple,
  SealCheck,
  EnvelopeSimple,
  SignIn,
  PencilSimple,
  ArrowRight,
} from "@phosphor-icons/react";
import { InvestorModal, type InvestorFormValue } from "@/components/investors/investor-modal";
import { formatInvestorBudget } from "@/lib/investors";
import { formatRelative } from "@/lib/utils";
import { isInvestorActive } from "@/lib/investor-activity";
import { toast } from "sonner";

export default function AdminPage() {
  const { status } = useSession();
  const router = useRouter();
  const [investors, setInvestors] = useState<InvestorFormValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<InvestorFormValue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadInvestors = useCallback(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d: InvestorFormValue[]) => {
        if (Array.isArray(d)) setInvestors(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadInvestors();
  }, [loadInvestors]);

  useEffect(() => {
    const t = setInterval(loadInvestors, 60_000);
    return () => clearInterval(t);
  }, [loadInvestors]);

  async function togglePortal(inv: InvestorFormValue) {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/investors/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalEnabled: inv.portalEnabled ? 0 : 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Změna přístupu se nezdařila");
        return;
      }
      toast.success(inv.portalEnabled ? "Portál deaktivován" : "Portál aktivován");
      setInvestors((prev) =>
        prev.map((p) => (p.id === inv.id ? { ...p, portalEnabled: inv.portalEnabled ? 0 : 1 } : p))
      );
    } catch {
      toast.error("Chyba sítě");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return investors.filter(
      (i) =>
        !q ||
        (i.name ?? "").toLowerCase().includes(q) ||
        (i.city ?? "").toLowerCase().includes(q) ||
        (i.email ?? "").toLowerCase().includes(q) ||
        (i.phone ?? "").includes(q)
    );
  }, [investors, search]);

  const summary = useMemo(() => {
    const activeNow = investors.filter((i) => isInvestorActive(i.lastActiveAt)).length;
    const withPortal = investors.filter((i) => i.portalEnabled === 1).length;
    const reservations = investors.reduce((s, i) => s + (i.reservations ?? 0), 0);
    const offerEmails = investors.reduce((s, i) => s + (i.offerEmails ?? 0), 0);
    return { total: investors.length, activeNow, withPortal, reservations, offerEmails };
  }, [investors]);

  if (status !== "authenticated" || loading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin · Investoři</h1>
        <p className="text-sm text-muted mt-1">Načítání...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin · Investoři</h1>
          <p className="text-sm text-muted mt-1">Přehled aktivity a správa přístupů investorů</p>
        </div>
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Hledat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <SummaryCard icon={<HandCoins size={15} weight="bold" />} label="Investoři" value={`${summary.total}`} tone="text-foreground" />
        <SummaryCard icon={<Pulse size={15} weight="fill" />} label="Aktivní nyní" value={`${summary.activeNow}`} tone="text-emerald-400" />
        <SummaryCard icon={<LockSimple size={15} weight="bold" />} label="S portálem" value={`${summary.withPortal}`} tone="text-accent" />
        <SummaryCard icon={<SealCheck size={15} weight="bold" />} label="Rezervace celkem" value={`${summary.reservations}`} tone="text-info" />
        <SummaryCard icon={<EnvelopeSimple size={15} weight="bold" />} label="Nabídky e-mailem" value={`${summary.offerEmails}`} tone="text-amber" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
          <p className="text-sm text-muted">
            {investors.length === 0 ? "Zatím žádní investoři." : "Žádní investoři neodpovídají hledání."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-4 text-xs text-muted font-medium">Investor</th>
                  <th className="text-left p-4 text-xs text-muted font-medium">Aktivita</th>
                  <th className="text-left p-4 text-xs text-muted font-medium">Portál</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Rezervace</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Nabídky e-mailem</th>
                  <th className="text-right p-4 text-xs text-muted font-medium">Přihlášení</th>
                  <th className="text-right p-4 text-xs text-muted font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.map((inv, idx) => {
                  const initials = (inv.name ?? "??").split(" ").map((n) => n[0]).join("").slice(0, 2);
                  const active = isInvestorActive(inv.lastActiveAt);
                  return (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-card-hover transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-mono font-medium">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/investors/${inv.id}`} className="font-medium hover:text-accent transition-colors">
                              {inv.name ?? "Neznámý"}
                            </Link>
                            <div className="text-xs text-muted truncate max-w-[220px]">
                              {[inv.email, inv.phone].filter(Boolean).join(" · ") || "bez kontaktu"}
                              {inv.city ? ` · ${inv.city}` : ""}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {inv.budgetUnlimited ? (
                                <Badge variant="secondary" size="sm" className="gap-0.5 text-[10px]">∞</Badge>
                              ) : (
                                <span className="text-[10px] text-muted">{formatInvestorBudget(inv.budget, inv.budgetUnlimited)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                            </span>
                            Aktivní nyní
                          </span>
                        ) : (
                          <span className="text-xs text-muted">
                            {inv.lastActiveAt ? formatRelative(inv.lastActiveAt) : "nikdy online"}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => togglePortal(inv)}
                          disabled={busyId === inv.id}
                          className="flex items-center gap-2"
                          title={inv.portalEnabled ? "Deaktivovat portál" : "Aktivovat portál"}
                        >
                          <span
                            className={`flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors ${
                              inv.portalEnabled ? "justify-end bg-accent/30 border-accent/40" : "justify-start bg-card border-border"
                            }`}
                          >
                            <span className={`h-5 w-5 rounded-full transition-colors ${inv.portalEnabled ? "bg-accent" : "bg-muted/40"}`} />
                          </span>
                          <span className={`text-xs ${inv.portalEnabled ? "text-accent" : "text-muted"}`}>
                            {inv.portalEnabled ? "zapnuto" : "vypnuto"}
                          </span>
                        </button>
                      </td>
                      <td className="p-4 text-right font-mono">{inv.reservations ?? 0}</td>
                      <td className="p-4 text-right font-mono">{inv.offerEmails ?? 0}</td>
                      <td className="p-4 text-right font-mono">{inv.loginCount ?? 0}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => setEditing(inv)}
                          >
                            <PencilSimple size={13} weight="bold" />
                            Upravit
                          </Button>
                          <Link
                            href={`/investors/${inv.id}`}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            Detail
                            <ArrowRight size={12} weight="bold" />
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted flex items-start gap-1.5">
        <SignIn size={13} weight="bold" className="shrink-0 mt-0.5" />
        Přihlašovací údaje investora se odvozují z jména — bez diakritiky, malými písmeny (první slovo = jméno, poslední = heslo). Seznam se aktualizuje každých 60 sekund.
      </p>

      <InvestorModal
        open={!!editing}
        investor={editing}
        onClose={() => setEditing(null)}
        onSaved={(inv) => {
          setInvestors((prev) => prev.map((p) => (p.id === inv.id ? { ...p, ...inv } : p)));
          setEditing(null);
        }}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-hover ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted leading-none">{label}</p>
        <p className={`text-lg font-semibold font-mono leading-tight mt-1 ${tone}`}>{value}</p>
      </div>
    </div>
  );
}
