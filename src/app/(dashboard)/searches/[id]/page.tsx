"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PropertyCard } from "@/components/ui/property-card";
import {
  MagnifyingGlass,
  Play,
  ArrowLeft,
  Clock,
} from "@phosphor-icons/react";
import Link from "next/link";

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

export default function SearchDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [data, setData] = useState<SearchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
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
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;
    fetchData();
  }, [status, params.id]);

  const runSearch = async () => {
    setRunning(true);
    await fetch(`/api/searches/${params.id}/run`, { method: "POST" });
    setRunning(false);
    fetchData();
  };

  if (loading || !data) {
    return (
      <div className="p-6 space-y-4">
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
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/searches">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft weight="bold" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{data.name}</h1>
              <Badge>{data.total} inzerátů</Badge>
              <Badge variant="secondary">{data.schedule}</Badge>
            </div>
            <p className="text-sm text-muted mt-1">{filterParts.join(" · ") || "Bez filtrů"}</p>
            {data.lastRunAt && !isNaN(new Date(data.lastRunAt).getTime()) && (
              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Poslední sken: {new Date(data.lastRunAt).toLocaleString("cs-CZ")}
              </p>
            )}
          </div>
        </div>
        <Button onClick={runSearch} loading={running}>
          <Play weight="fill" />
          Spustit skenování
        </Button>
      </div>

      {data.results.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass className="w-6 h-6" />}
          title="Zatím žádné výsledky"
          description="Spusťte skenování pro nalezení inzerátů odpovídajících vašim filtrům."
          action={
            <Button onClick={runSearch} loading={running}>
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
              <motion.div key={r.propertyId} variants={containerVariants}>
                <PropertyCard
                  id={r.property.id}
                  title={r.property.title}
                  price={r.property.price}
                  pricePerSqm={r.property.pricePerSqm ?? undefined}
                  address={r.property.address ?? r.property.title}
                  score={r.analysis?.investmentScore ?? 0}
                  area={r.property.area ? `${r.property.area} m²` : undefined}
                  rooms={r.property.rooms ?? undefined}
                  days={0}
                  imageUrl={images[0]}
                  undervaluationPct={
                    r.analysis?.undervaluationPct != null && r.analysis.undervaluationPct > 0
                      ? r.analysis.undervaluationPct
                      : undefined
                  }
                  status={r.analysis?.verdictLevel ?? undefined}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
