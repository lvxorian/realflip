"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { MagnifyingGlass, Plus, Clock, Play } from "@phosphor-icons/react";

interface SearchItem {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  schedule: string;
  lastRunAt: number | null;
  createdAt: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
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

function formatDate(ts: number | null) {
  if (!ts) return "Nikdy";
  return new Date(ts).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function filterSummary(filters: Record<string, unknown>): string {
  const parts: string[] = [];
  if (filters.location) parts.push(String(filters.location));
  if (filters.priceMin || filters.priceMax) {
    const min = filters.priceMin ? `${Number(filters.priceMin).toLocaleString()}` : "";
    const max = filters.priceMax ? `${Number(filters.priceMax).toLocaleString()}` : "";
    parts.push(`${min}–${max} Kč`);
  }
  if (filters.areaMin || filters.areaMax) {
    const min = filters.areaMin ?? "";
    const max = filters.areaMax ?? "";
    parts.push(`${min}–${max} m²`);
  }
  return parts.join(" · ") || "Bez filtrů";
}

export default function SearchesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searches, setSearches] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch("/api/searches")
      .then((r) => r.json())
      .then((data) => setSearches(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, router]);

  const runSearch = async (id: string) => {
    setRunning(id);
    await fetch(`/api/searches/${id}/run`, { method: "POST" });
    setRunning(null);
    const res = await fetch("/api/searches");
    const data = await res.json();
    setSearches(data);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hledání</h1>
          <p className="text-muted text-sm mt-1">
            Vytvářejte cílená hledání nemovitostí
          </p>
        </div>
        <Link href="/searches/new">
          <Button>
            <Plus weight="bold" />
            Nové hledání
          </Button>
        </Link>
      </div>

      {searches.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass className="w-6 h-6" />}
          title="Žádná hledání"
          description="Vytvořte své první hledání a začněte objevovat investiční příležitosti."
          action={
            <Link href="/searches/new">
              <Button>
                <Plus weight="bold" />
                Nové hledání
              </Button>
            </Link>
          }
        />
      ) : (
        <motion.div className="space-y-3" variants={containerVariants}>
          {searches.map((s) => (
            <motion.div key={s.id} variants={itemVariants}>
              <Link href={`/searches/${s.id}`} className="block">
                <Card className="hover:bg-card-hover transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MagnifyingGlass className="w-4 h-4 text-accent shrink-0" />
                          <h3 className="font-semibold truncate">{s.name}</h3>
                        </div>
                        <p className="text-sm text-muted mt-1 truncate">
                          {filterSummary(s.filters)}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Poslední: {formatDate(s.lastRunAt)}
                          </span>
                          <span className="capitalize">{s.schedule}</span>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        loading={running === s.id}
                        onClick={(e) => {
                          e.preventDefault();
                          runSearch(s.id);
                        }}
                      >
                        <Play weight="fill" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
