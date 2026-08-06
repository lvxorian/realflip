"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MagnifyingGlass, Plus, Phone, Envelope, MapPin, Infinity as InfinityIcon, LockSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { InvestorModal, type InvestorFormValue } from "@/components/investors/investor-modal";
import { formatInvestorBudget } from "@/lib/investors";
import { formatRelative } from "@/lib/utils";
import { isInvestorActive } from "@/lib/investor-activity";

export default function InvestorsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [investors, setInvestors] = useState<InvestorFormValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadInvestors = useCallback(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d: InvestorFormValue[]) => { if (Array.isArray(d)) setInvestors(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadInvestors();
  }, [loadInvestors]);

  useEffect(() => {
    const t = setInterval(loadInvestors, 60_000);
    return () => clearInterval(t);
  }, [loadInvestors]);

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

  const filtered = investors.filter((i) => {
    const q = search.toLowerCase();
    return !q ||
      (i.name ?? "").toLowerCase().includes(q) ||
      (i.city ?? "").toLowerCase().includes(q) ||
      (i.phone ?? "").includes(q) ||
      (i.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investoři</h1>
          <p className="text-sm text-muted mt-1">{investors.length} investorů pro vaše projekty</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Hledat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 w-56"
            />
          </div>
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => setShowModal(true)}>
            <Plus size={14} weight="bold" />
            Přidat
          </Button>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((i, idx) => {
            const initials = (i.name ?? "??").split(" ").map((n) => n[0]).join("").slice(0, 2);
            return (
              <Link key={i.id} href={`/investors/${i.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover hover:border-accent/20 transition-all cursor-pointer h-full"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-mono font-medium">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">{i.name ?? "Neznámý"}</h3>
                      {i.budgetUnlimited ? (
                        <Badge variant="default" size="sm" className="mt-1 gap-1">
                          <InfinityIcon size={11} weight="fill" />
                          Neomezeno
                        </Badge>
                      ) : (
                        <Badge variant="secondary" size="sm" className="mt-1">
                          {formatInvestorBudget(i.budget, i.budgetUnlimited)}
                        </Badge>
                      )}
                      {!!i.portalEnabled && (
                        <Badge variant="secondary" size="sm" className="mt-1 ml-1 gap-1 border-accent/30 text-accent">
                          <LockSimple size={11} weight="bold" />
                          Portál
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {i.city && (
                      <div className="flex items-center gap-2 text-muted">
                        <MapPin size={12} weight="bold" />
                        {i.city}
                      </div>
                    )}
                    {i.phone && (
                      <div className="flex items-center gap-2 text-muted">
                        <Phone size={12} weight="bold" />
                        {i.phone}
                      </div>
                    )}
                    {i.email && (
                      <div className="flex items-center gap-2 text-muted truncate">
                        <Envelope size={12} weight="bold" />
                        <span className="truncate">{i.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 border-t border-border/40 pt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      {isInvestorActive(i.lastActiveAt) ? (
                        <>
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                          <span className="font-medium text-emerald-400">Aktivní nyní</span>
                        </>
                      ) : (
                        <span className="text-muted">
                          Naposledy online: {i.lastActiveAt ? formatRelative(i.lastActiveAt) : "nikdy"}
                        </span>
                      )}
                      <span className="text-muted/60">· {i.loginCount ?? 0} přihlášení</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <span>{i.reservations ?? 0} rezervací</span>
                      <span className="text-muted/40">·</span>
                      <span>{i.offerEmails ?? 0} nabídek e-mailem</span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      )}

      <InvestorModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={(inv) =>
          setInvestors((prev) => [inv, ...prev])
        }
      />
    </div>
  );
}
