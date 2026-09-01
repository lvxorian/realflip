"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BulkSearchLog } from "@/components/searches/bulk-search-log";
import { PropertyCard } from "@/components/ui/property-card";
import {
  MagnifyingGlass,
  Play,
  ArrowLeft,
  Clock,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { SCHEDULE_LABELS } from "@/components/searches/search-form";

interface SearchResult {
  searchId: string;
  propertyId: string;
  firstSeen: number;
  lastSeen: number;
  property: {
    id: string;
    title: string;
    price: number;
    pricePerSqm: number | null;
    area: number | null;
    rooms: string | null;
    address: string | null;
    imageUrls: string;
    portalName: string;
    condition: string | null;
    url: string;
    isActive: number;
    firstSeen: number;
    priceRating: string | null;
    isEarlyOffer: number | null;
  };
  analysis: {
    investmentScore: number | null;
    recommendation: string | null;
    roi: number | null;
    undervaluationPct: number | null;
    verdictLevel: string | null;
    locationCity: string | null;
  } | null;
}

interface SearchDetail {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  schedule: string;
  lastRunAt: number | null;
  createdAt: number;
  results: SearchResult[];
  total: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 20 },
  },
};

export default function SearchDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [now] = useState(() => Date.now());
  const [data, setData] = useState<SearchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/searches/${params.id}`);
      if (!res.ok) { router.push("/searches"); return; }
      setData(await res.json());
    } catch {
      router.push("/searches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;

    fetch(`/api/searches/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((d: SearchDetail) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) router.push("/searches");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, router, params.id]);

  // Skenování běží přes live log (SSE stream z /api/searches/[id]/run).
  const runSearch = () => {
    setShowLog(true);
  };

  const deleteSearch = async () => {
    if (!confirm(`Opravdu chcete smazat hledání „${data?.name ?? ""}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/searches/${params.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Smazání hledání selhalo");
        return;
      }
      toast.success("Hledání smazáno");
      router.push("/searches");
    } catch {
      toast.error("Smazání hledání selhalo");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const f = data.filters;
  const filterParts: string[] = [];
  if (f.location) filterParts.push(String(f.location));
  if (f.district) filterParts.push(String(f.district));
  if (f.priceMin || f.priceMax) {
    filterParts.push(
      `${f.priceMin ? Number(f.priceMin).toLocaleString() : "0"} – ${f.priceMax ? Number(f.priceMax).toLocaleString() : "∞"} Kč`
    );
  }
  if (f.areaMin || f.areaMax) {
    filterParts.push(`${f.areaMin ?? 0} – ${f.areaMax ?? "∞"} m²`);
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/searches">
            <Button variant="ghost" size="icon-sm" className="h-10 w-10 shrink-0">
              <ArrowLeft weight="bold" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{data.name}</h1>
              <Badge>{data.total} inzerátů</Badge>
              <Badge variant="secondary">{SCHEDULE_LABELS[data.schedule] ?? data.schedule}</Badge>
            </div>
            <p className="text-sm text-muted mt-1">{filterParts.join(" · ") || "Bez filtrů"}</p>
            {data.lastRunAt != null && !isNaN(new Date(Number(data.lastRunAt)).getTime()) && (
              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Poslední sken: {new Date(Number(data.lastRunAt)).toLocaleString("cs-CZ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={runSearch} disabled={showLog}>
            <Play weight="fill" />
            Spustit skenování
          </Button>
          <Button variant="secondary" onClick={deleteSearch} loading={deleting} className="text-xs gap-1.5">
            <Trash size={12} weight="bold" />
            Smazat
          </Button>
        </div>
      </div>

      {data.results.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass className="w-6 h-6" />}
          title="Zatím žádné výsledky"
          description="Spusťte skenování pro nalezení inzerátů odpovídajících vašim filtrům."
          action={
            <Button onClick={runSearch} disabled={showLog}>
              <Play weight="fill" />
              Spustit skenování
            </Button>
          }
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
        >
          {data.results.map((r) => {
            const images = (() => {
              try { return JSON.parse(r.property.imageUrls); } catch { return []; }
            })();
            return (
              <motion.div key={r.propertyId} variants={itemVariants}>
                <PropertyCard
                  id={r.property.id}
                  title={r.property.title}
                  price={r.property.price}
                  pricePerSqm={r.property.pricePerSqm ?? undefined}
                  address={r.property.address ?? r.property.title}
                  score={r.analysis?.investmentScore ?? 0}
                  area={r.property.area ? `${r.property.area} m²` : undefined}
                  rooms={r.property.rooms ?? undefined}
                  days={r.property.firstSeen ? Math.round((now - r.property.firstSeen) / 86400000) : 0}
                  imageUrl={images[0]}
                  undervaluationPct={
                    r.analysis?.undervaluationPct != null && r.analysis.undervaluationPct > 0
                      ? r.analysis.undervaluationPct
                      : undefined
                  }
                  status={r.analysis?.verdictLevel ?? undefined}
                  priceRating={r.property.priceRating ?? undefined}
                  earlyOffer={(r.property.isEarlyOffer ?? 0) === 1}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <BulkSearchLog
        open={showLog}
        url={`/api/searches/${params.id}/run`}
        title={data.name}
        onClose={() => setShowLog(false)}
        onFinished={fetchData}
      />
    </motion.div>
  );
}
