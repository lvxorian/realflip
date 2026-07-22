"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText,
  Funnel,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react";
import { RegionManagerModal } from "@/components/off-market/region-manager-modal";

interface OffMarketLead {
  id: string;
  debtorName: string;
  caseNumber: string;
  address: string | null;
  region: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nový",
  KN_CHECK: "Kontrola KN",
  LETTER_SENT: "Dopis odeslán",
  RESPONDED: "Odpověděli",
  ARCHIVED: "Archiv",
};

const STATUS_VARIANTS: Record<string, "info" | "warning" | "default" | "success" | "secondary"> = {
  NEW: "info",
  KN_CHECK: "warning",
  LETTER_SENT: "default",
  RESPONDED: "success",
  ARCHIVED: "secondary",
};

function formatDate(ts: number | null | string) {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(parseInt(ts)) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OffMarketPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<OffMarketLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRegions, setShowRegions] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (regionFilter) params.set("region", regionFilter);
    if (searchQuery) params.set("search", searchQuery);

    fetch(`/api/off-market/leads?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setLeads(data.leads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, statusFilter, regionFilter, searchQuery, router]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.region) set.add(l.region); });
    return Array.from(set).sort();
  }, [leads]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Off-Market</h1>
          <p className="text-sm text-muted mt-1">Insolvenční řízení a neveřejné příležitosti</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowRegions(true)}>
          <Plus weight="bold" />
          Spravovat lokality
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" weight="regular" />
          <input
            type="text"
            placeholder="Hledat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border/50 bg-card pl-9 pr-3 text-xs text-foreground focus:outline-none focus:border-accent/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50"
        >
          <option value="">Všechny stavy</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-muted focus:outline-none focus:border-accent/50"
        >
          <option value="">Všechny regiony</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Žádné off-market příležitosti"
          description="Zatím nebyly naskenovány žádné insolvenční záznamy. Po spuštění ISIR Hunter se zde objeví."
        />
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-4 text-xs text-muted font-medium">Datum</th>
                  <th className="text-left p-4 text-xs text-muted font-medium">Jméno dlužníka</th>
                  <th className="text-left p-4 text-xs text-muted font-medium">Spisová značka</th>
                  <th className="text-left p-4 text-xs text-muted font-medium">Adresa</th>
                  <th className="text-left p-4 text-xs text-muted font-medium">Region</th>
                  <th className="text-left p-4 text-xs text-muted font-medium">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-card-hover transition-colors cursor-pointer"
                    onClick={() => router.push(`/off-market/${lead.id}`)}
                  >
                    <td className="p-4 text-xs text-muted whitespace-nowrap">{formatDate(lead.createdAt)}</td>
                    <td className="p-4 font-medium">{lead.debtorName}</td>
                    <td className="p-4 font-mono text-xs">{lead.caseNumber}</td>
                    <td className="p-4 text-muted text-xs max-w-[200px] truncate">{lead.address || "—"}</td>
                    <td className="p-4 text-xs text-muted capitalize">{lead.region || "—"}</td>
                    <td className="p-4">
                      <Badge variant={STATUS_VARIANTS[lead.status] || "default"} size="sm">
                        {STATUS_LABELS[lead.status] || lead.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-xs text-muted border-t border-border/30">
            {leads.length} záznamů
          </div>
        </div>
      )}
    </motion.div>
      <RegionManagerModal open={showRegions} onClose={() => setShowRegions(false)} />
    </>
  );
}
