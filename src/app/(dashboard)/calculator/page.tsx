"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import InteractiveAnalysis from "@/components/calculator/interactive-analysis";
import { classifyLocation } from "@/lib/analysis/location";
import { analyzeListing } from "@/lib/analysis/analyzer";

const PROPERTY_TYPES = [
  { value: "flat", label: "Byt" },
  { value: "house", label: "Dům" },
  { value: "land", label: "Pozemek" },
];

const CONDITIONS = [
  { value: "new", label: "Novostavba" },
  { value: "renovated", label: "Po rekonstrukci" },
  { value: "good", label: "Dobrý" },
  { value: "original", label: "Původní" },
  { value: "dilapidated", label: "Zchátralý" },
];

const ROOM_TYPES = [
  { value: "1+kk", label: "1+kk" },
  { value: "1+1", label: "1+1" },
  { value: "2+kk", label: "2+kk" },
  { value: "2+1", label: "2+1" },
  { value: "3+kk", label: "3+kk" },
  { value: "3+1", label: "3+1" },
  { value: "4+kk", label: "4+kk" },
  { value: "4+1", label: "4+1" },
  { value: "5+", label: "5+" },
];

export default function CalculatorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [rooms, setRooms] = useState("");
  const [condition, setCondition] = useState("");
  const [floor, setFloor] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [marketLow, setMarketLow] = useState("");
  const [marketHigh, setMarketHigh] = useState("");
  const [loadingMarket, setLoadingMarket] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function fetchMarket() {
    if (!city.trim()) return;
    setLoadingMarket(true);
    try {
      const res = await fetch(`/api/market-range?city=${encodeURIComponent(city.trim())}`);
      const data = await res.json();
      if (data && data.low) setMarketLow(data.low.toString());
      if (data && data.high) setMarketHigh(data.high.toString());
    } catch {}
    setLoadingMarket(false);
  }

  const result = useMemo(() => {
    const p = parseInt(price) || 0;
    const a = parseInt(area) || 0;
    if (!title || !p || !a) return null;

    const addressStr = address || title;
    const location = classifyLocation(addressStr, title);
    const marketPriceSqm = parseInt(marketLow) || 0;
    const pricePerSqm = Math.round(p / a);

    const listing: any = {
      portalName: "manual",
      title,
      price: p,
      pricePerSqm,
      area: a,
      rooms: rooms || null,
      floor: floor ? parseInt(floor) : null,
      condition: condition || null,
      buildingType: null,
      yearBuilt: null,
      address: addressStr,
      lat: null,
      lng: null,
      description: description || null,
      imageUrls: [],
      url: "",
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      publishedAt: new Date(),
      updatedAt: new Date(),
    };

    const marketRange: { low: number; high: number; median: number } | undefined = marketPriceSqm > 0 ? { low: parseInt(marketLow), high: parseInt(marketHigh), median: parseInt(marketLow) } : undefined;
    const analysis = analyzeListing(listing, marketRange, undefined, location.city !== "Neznámá" ? location : undefined);

    return {
      url: "",
      portal: "manual",
      success: true,
      listing: {
        id: undefined,
        title: listing.title,
        price: listing.price,
        area: listing.area,
        rooms: listing.rooms,
        condition: listing.condition,
        address: listing.address,
        description: listing.description?.slice(0, 500),
        imageUrls: [],
        contactPhone: null,
        contactName: null,
        contactEmail: null,
      },
      analysis: {
        pricePerSqm: analysis.pricePerSqm,
        marketPricePerSqmLow: analysis.marketPricePerSqmLow,
        marketPricePerSqmHigh: analysis.marketPricePerSqmHigh,
        undervaluationPct: analysis.undervaluationPct,
        overpricingPct: analysis.overpricingPct,
        investmentScore: analysis.investmentScore,
        verdictLevel: analysis.verdictLevel,
        recommendation: analysis.recommendation,
        verdictSummary: analysis.verdictSummary,
        arv: analysis.arv,
        roi: analysis.roi,
        netProfit: analysis.netProfit,
        targetPurchasePrice: analysis.targetPurchasePrice,
        priceReductionNeeded: analysis.priceReductionNeeded,
        priceReductionPct: analysis.priceReductionPct,
        condition: analysis.condition,
        location: analysis.location,
        buildingType: analysis.buildingType,
        segmentRating: analysis.segmentRating,
        occupancy: analysis.occupancy,
        missingFields: analysis.missingFields,
        redFlags: analysis.redFlags,
        scenarios: analysis.scenarios,
      },
      aiSummary: null,
      aiNegotiationTips: null,
      aiComparableNotes: null,
      aiHiddenInfo: null,
    } as any;
  }, [title, price, area, rooms, condition, floor, description, address, marketLow, marketHigh]);

  async function saveToDb() {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/calculator/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.listing.title,
          price: result.listing.price,
          pricePerSqm: result.analysis.pricePerSqm,
          area: result.listing.area,
          rooms: result.listing.rooms,
          floor: null,
          condition: result.listing.condition,
          address: result.listing.address,
          city: result.analysis.location?.city,
          description: result.listing.description,
          arv: result.analysis.arv,
          renovationCost: result.analysis.scenarios?.conservative?.renovationCost,
          targetRoi: 15,
          roi: result.analysis.roi,
          netProfit: result.analysis.netProfit,
        }),
      });
      const data = await res.json();
      if (data.propertyId) {
        setSavedId(data.propertyId);
        router.push(`/properties/${data.propertyId}`);
      }
    } catch {}
    setSaving(false);
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kalkulačka flipu</h1>
        <p className="text-sm text-muted mt-1">Výpočet pro offline / externí inzeráty</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold tracking-tight text-sm">Základní údaje</h2>
              <Input label="Název / adresa" placeholder="např. Byt 3+kk, Praha 8" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Město" placeholder="např. Praha" value={city} onChange={(e) => setCity(e.target.value)} onBlur={fetchMarket} />
                <Input label="Cena (Kč)" type="number" placeholder="např. 4890000" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Plocha (m²)" type="number" placeholder="např. 50" value={area} onChange={(e) => setArea(e.target.value)} />
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Dispozice</label>
                  <select value={rooms} onChange={(e) => setRooms(e.target.value)} className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-accent/50">
                    <option value="">—</option>
                    {ROOM_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground/80 block mb-1.5">Stav</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-accent/50">
                    <option value="">—</option>
                    {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <Input label="Podlaží" type="number" placeholder="např. 2" value={floor} onChange={(e) => setFloor(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/80 block mb-1.5">Popis (volitelné)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 transition-colors resize-none" placeholder="Stručný popis nemovitosti..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold tracking-tight text-sm">Tržní data</h2>
              <div className="flex items-center gap-2">
                <Input label="Trh/m² od" type="number" value={marketLow} onChange={(e) => setMarketLow(e.target.value)} className="flex-1" />
                <span className="text-muted mt-6">–</span>
                <Input label="Trh/m² do" type="number" value={marketHigh} onChange={(e) => setMarketHigh(e.target.value)} className="flex-1" />
              </div>
              {city && (
                <Button variant="secondary" size="sm" onClick={fetchMarket} loading={loadingMarket} className="text-xs">
                  Načíst z města
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Result */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {result ? (
            <InteractiveAnalysis result={result} index={0} />
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted">
              Vyplňte název, cenu a plochu pro zobrazení analýzy.
            </div>
          )}

          {result && !savedId && (
            <div className="flex gap-3 mt-4">
              <Button onClick={saveToDb} disabled={saving} className="flex-1 text-sm gap-2">
                {saving ? "Ukládám..." : "💾 Uložit do databáze"}
              </Button>
              <Button variant="secondary" disabled className="flex-1 text-sm gap-2">
                📄 Export PDF
              </Button>
            </div>
          )}

          {savedId && (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-center mt-4">
              <p className="text-sm text-emerald-400 font-medium">✅ Uloženo. Přesměrovávám na detail...</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
