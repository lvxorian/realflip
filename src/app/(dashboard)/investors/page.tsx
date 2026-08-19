"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MagnifyingGlass,
  Plus,
  Phone,
  Envelope,
  MapPin,
  Infinity as InfinityIcon,
  LockSimple,
  PencilSimple,
  HandCoins,
  Pulse,
  SealCheck,
  EnvelopeSimple,
  SignIn,
} from "@phosphor-icons/react";
import { InvestorModal, type InvestorFormValue } from "@/components/investors/investor-modal";
import { formatInvestorBudget } from "@/lib/investors";
import { formatRelative } from "@/lib/utils";
import { isInvestorActive } from "@/lib/investor-activity";
import { toast } from "sonner";

export default function InvestorsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [investors, setInvestors] = useState<InvestorFormValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InvestorFormValue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unreadByInvestor, setUnreadByInvestor] = useState<Record<string, number>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const load = async () => {
      try {
        const res = await fetch("/api/investors/unread-reservations");
        if (res.ok) {
          const d = await res.json();
          setUnreadByInvestor(d.byInvestor ?? {});
        }
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [status]);

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
        (i.phone ?? "").includes(q) ||
        (i.email ?? "").toLowerCase().includes(q)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investoři</h1>
          <p className="text-sm text-muted mt-1">Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investoři</h1>
          <p className="text-sm text-muted mt-1">Správa investorů, přístupů a portálové aktivity.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Hledat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9 w-full sm:w-56"
            />
          </div>
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => setShowModal(true)}>
            <Plus size={14} weight="bold" />
            Přidat investora
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <SummaryCard icon={<HandCoins size={15} weight="bold" />} label="Investoři" value={`${summary.total}`} tone="text-foreground" />
        <SummaryCard icon={<Pulse size={15} weight="fill" />} label="Aktivní nyní" value={`${summary.activeNow}`} tone="text-emerald-400" />
        <SummaryCard icon={<LockSimple size={15} weight="bold" />} label="S portálem" value={`${summary.withPortal}`} tone="text-accent" />
        <SummaryCard icon={<SealCheck size={15} weight="bold" />} label="Rezervace" value={`${summary.reservations}`} tone="text-info" />
        <SummaryCard icon={<EnvelopeSimple size={15} weight="bold" />} label="Nabídky e-mailem" value={`${summary.offerEmails}`} tone="text-amber" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
          <p className="text-sm text-muted">
            {investors.length === 0
              ? "Zatím žádní investoři. Přidejte prvního investora pro financování projektů."
              : "Žádní investoři neodpovídají hledání."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((inv, idx) => {
            const initials = (inv.name ?? "??").split(" ").map((n) => n[0]).join("").slice(0, 2);
            const active = isInvestorActive(inv.lastActiveAt);
            const unreadCount = unreadByInvestor[inv.id] ?? 0;
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/investors/${inv.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/investors/${inv.id}`);
                  }
                }}
                className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-mono font-medium">
                      {initials}
                    </div>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white px-1">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">{inv.name ?? "Neznámý"}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {!!inv.city && (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <MapPin size={12} weight="bold" />
                          {inv.city}
                        </span>
                      )}
                      {!!inv.phone && (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <Phone size={12} weight="bold" />
                          {inv.phone}
                        </span>
                      )}
                    </div>
                    {!!inv.email && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted truncate">
                        <Envelope size={12} weight="bold" />
                        <span className="truncate">{inv.email}</span>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 items-center text-xs">
                      {inv.budgetUnlimited ? (
                        <Badge variant="secondary" size="sm" className="gap-1">
                          <InfinityIcon size={11} weight="fill" />
                          Neomezeno
                        </Badge>
                      ) : (
                        <Badge variant="secondary" size="sm">{formatInvestorBudget(inv.budget, inv.budgetUnlimited)}</Badge>
                      )}
                      {!!inv.portalEnabled && (
                        <Badge variant="secondary" size="sm" className="gap-1 border-accent/30 text-accent">
                          <LockSimple size={11} weight="bold" />
                          Portál
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted">
                  {active ? (
                    <div className="inline-flex items-center gap-2 text-emerald-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                      Aktivní nyní
                    </div>
                  ) : (
                    <div>Naposledy online: {inv.lastActiveAt ? formatRelative(inv.lastActiveAt) : "nikdy"}</div>
                  )}
                  <div className="text-xs text-muted/70">
                    {inv.loginCount ?? 0} přihlášení · {inv.reservations ?? 0} rezervací · {inv.offerEmails ?? 0} nabídek
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" className="gap-2" onClick={(e) => { e.stopPropagation(); setEditing(inv); }}>
                    <PencilSimple size={14} weight="bold" />
                    Upravit
                  </Button>
                  <Button
                    size="sm"
                    variant={inv.portalEnabled ? "default" : "secondary"}
                    onClick={(e) => { e.stopPropagation(); togglePortal(inv); }}
                    disabled={busyId === inv.id}
                    className="gap-2"
                  >
                    <LockSimple size={14} weight="bold" />
                    {inv.portalEnabled ? "Portál vypnout" : "Portál zapnout"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted flex items-start gap-1.5">
        <SignIn size={13} weight="bold" className="shrink-0 mt-0.5" />
        Přihlašovací údaje investora se odvozují z jména — bez diakritiky, malými písmeny (první slovo = jméno, poslední = heslo). Seznam se aktualizuje každých 60 sekund.
      </p>

      <InvestorModal
        open={showModal || !!editing}
        investor={editing}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onSaved={(inv) => {
          setInvestors((prev) => {
            const exists = prev.some((item) => item.id === inv.id);
            if (exists) {
              return prev.map((item) => (item.id === inv.id ? { ...item, ...inv } : item));
            }
            return [inv, ...prev];
          });
          setShowModal(false);
          setEditing(null);
        }}
        onDeleted={(id) => {
          setInvestors((prev) => prev.filter((item) => item.id !== id));
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
