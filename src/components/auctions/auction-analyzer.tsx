"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkSimple, Lightning, Warning } from "@phosphor-icons/react";
import type { ParsedAuction } from "@/lib/auctions/parse-auction";

interface AuctionAnalyzerProps {
  onParsed: (result: ParsedAuction) => void;
}

export function AuctionAnalyzer({ onParsed }: AuctionAnalyzerProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/parse-auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Analýza se nezdařila. Zkuste to prosím později.");
        return;
      }
      onParsed(data.parsed);
    } catch {
      setError("Analýza se nezdařila. Zkuste to prosím později.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightning size={18} weight="duotone" className="text-accent" />
          <div>
            <h2 className="font-semibold tracking-tight text-sm">1-Click Due Diligence</h2>
            <p className="text-xs text-muted">
              Vložte odkaz na dražbu z portaldrazeb.cz a analyzujeme ji za vás
            </p>
          </div>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
        >
          <div className="relative flex-1">
            <LinkSimple
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              type="url"
              placeholder="https://www.portaldrazeb.cz/detail/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" loading={loading} disabled={!url.trim()}>
            {loading ? "Analyzuji..." : "Analyzovat"}
          </Button>
        </form>
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-danger mt-3">
            <Warning size={14} weight="bold" />
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
