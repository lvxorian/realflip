"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LetterModal } from "@/components/off-market/letter-modal";
import {
  ArrowLeft,
  FileText,
  Envelope,
  ArrowSquareOut,
} from "@phosphor-icons/react";

interface OffMarketLead {
  id: string;
  debtorName: string;
  caseNumber: string;
  address: string | null;
  region: string | null;
  status: string;
  notes: string | null;
  rawData: string;
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

const STATUS_OPTIONS = [
  { value: "NEW", label: "Nový" },
  { value: "KN_CHECK", label: "Kontrola KN" },
  { value: "LETTER_SENT", label: "Dopis odeslán" },
  { value: "RESPONDED", label: "Odpověděli" },
  { value: "ARCHIVED", label: "Archiv" },
];

function formatDate(ts: number | null | string) {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(parseInt(ts)) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(rawData: string) {
  try {
    const d = JSON.parse(rawData);
    if (d?.estimatedPrice) {
      return new Intl.NumberFormat("cs-CZ", { style: "decimal", maximumFractionDigits: 0 }).format(d.estimatedPrice) + " Kč";
    }
  } catch {}
  return "—";
}

export default function OffMarketDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [lead, setLead] = useState<OffMarketLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated" || !params.id) return;

    fetch(`/api/off-market/leads/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setLead(data);
        setNewStatus(data.status);
        setNotes(data.notes ?? "");
      })
      .catch(() => router.push("/off-market"))
      .finally(() => setLoading(false));
  }, [status, params.id, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/off-market/leads/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      if (res.ok) {
        setLead((prev) => prev ? { ...prev, status: newStatus, notes } : prev);
      }
    } catch {}
    setSaving(false);
  };

  if (loading || !lead) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <Link
        href="/off-market"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} weight="bold" />
        Zpět na přehled
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{lead.debtorName}</h1>
                  <p className="text-sm text-muted font-mono mt-1">{lead.caseNumber}</p>
                </div>
                <Badge variant={
                  lead.status === "NEW" ? "info" :
                  lead.status === "KN_CHECK" ? "warning" :
                  lead.status === "LETTER_SENT" ? "default" :
                  lead.status === "RESPONDED" ? "success" : "secondary"
                }>
                  {STATUS_LABELS[lead.status] || lead.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted">Město</span>
                  <p className="font-medium mt-0.5">{lead.address || "Neuvedeno"}</p>
                </div>
                <div>
                  <span className="text-muted">Kraj</span>
                  <p className="font-medium mt-0.5 capitalize">{lead.region || "Neuveden"}</p>
                </div>
                <div>
                  <span className="text-muted">Cena</span>
                  <p className="font-medium mt-0.5">{formatPrice(lead.rawData)}</p>
                </div>
                <div>
                  <span className="text-muted">Zachyceno</span>
                  <p className="font-medium mt-0.5">{formatDate(lead.createdAt)}</p>
                </div>
              </div>

              {(() => {
                try { var r = JSON.parse(lead.rawData); } catch { return null; }
                var link = r?.link;
                if (!link) return null;
                return (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                  >
                    <ArrowSquareOut size={14} weight="bold" />
                    Zobrazit detail dražby
                  </a>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold tracking-tight text-sm">Poznámky</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Vlastní poznámky k tomuto záznamu..."
                className="w-full min-h-[120px] rounded-xl border border-border/50 bg-card p-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 resize-y"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold tracking-tight text-sm">Stav</h2>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent/50"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <Button onClick={handleSave} loading={saving} className="w-full">
                Uložit změny
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold tracking-tight text-sm">Akce</h2>
              <Button
                onClick={() => setShowLetter(true)}
                variant="secondary"
                className="w-full"
              >
                <Envelope size={16} weight="bold" />
                Generovat oslovovací dopis
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <LetterModal
        open={showLetter}
        onClose={() => setShowLetter(false)}
        debtorName={lead.debtorName}
        caseNumber={lead.caseNumber}
        address={lead.address}
      />
    </motion.div>
  );
}
