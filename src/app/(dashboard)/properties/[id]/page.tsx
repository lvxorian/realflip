"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TiltCard } from "@/components/ui/tilt-card";
import { motion } from "framer-motion";
import {
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  Target,
  ArrowLeft,
  Phone,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Share2,
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [calcOpen, setCalcOpen] = useState(true);
  const [purchasePrice, setPurchasePrice] = useState(4890000);
  const [renoLevel, setRenoLevel] = useState<"light" | "medium" | "full">("medium");

  const property = {
    id: params.id,
    title: "Byt 3+kk, Praha 8 – Karlín",
    price: 4890000,
    pricePerSqm: 97800,
    area: 50,
    rooms: "3+kk",
    floor: 4,
    condition: "původní",
    yearBuilt: 1985,
    address: "Sokolovská 123, Praha 8",
    lat: 50.092,
    lng: 14.455,
    description:
      "Byt v osobním vlastnictví v cihlovém domě v Karlíně. Původní stav, nutná rekonstrukce. Dům po kompletní revitalizaci včetně nové fasády, oken a výtahu. Vytápění dálkové. V okolí veškerá občanská vybavenost, MHD 2 minuty.",
    contactName: "Jan Novák",
    contactPhone: "+420 777 123 456",
    contactEmail: "jan.novak@reality.cz",
    contactType: "agent",
    publishedAt: "2026-06-21",
    portalName: "sreality",
    imageUrls: [],
    priceHistory: [
      { price: 5250000, date: "2026-05-15" },
      { price: 5100000, date: "2026-05-28" },
      { price: 4890000, date: "2026-06-10" },
    ],
  };

  const analysis = {
    marketValue: 5850000,
    undervaluationPct: 16.4,
    investmentScore: 82,
    arv: 7450000,
    renovationCost: 1100000,
    totalCost: 4990000 + 1100000 + 200000 + 150000,
    netProfit: 1010000,
    roi: 15.7,
    annualizedRoi: 31.4,
    cashOnCash: 22.3,
    breakEvenPrice: 4100000,
    recommendation: "buy" as const,
    aiReport: {
      summary:
        "Nemovitost vykazuje výrazný investiční potenciál díky podhodnocení o 16.4% oproti tržní ceně. Lokalita Karlín je jednou z nejžádanějších v Praze s rostoucím trendem cen. Dům je po revitalizaci, což eliminuje riziko velkých investic do společných prostor.",
      sentiment: "urgent",
      maxBid: 5200000,
      negotiationTips: [
        "Cena již byla snížena 2x – signalizuje motivaci prodejce",
        "Poukažte na nutnost kompletní rekonstrukce (odhad 1.1 mil.)",
        "Navrhněte rychlé uzavření (do 14 dní) za nižší cenu",
        "Zmiňte srovnatelné byty v okolí za 5.5–6 mil.",
      ],
      redFlags: [],
      hiddenInfo: [
        "Prodejce řeší dědictví – motivovaný k rychlému prodeji",
        "V domě je plánovaná výměna výtahu v roce 2027 (možná mimořádná platba)",
      ],
      comparableNotes: "Srovnatelné byty v okolí: 52m² za 5.8 mil., 48m² za 5.5 mil., 55m² za 6.2 mil.",
    },
  };

  function formatPrice(p: number) {
    return `${(p / 1000000).toFixed(1)} mil. Kč`;
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/properties")}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Zpět na přehled
      </button>

      {/* Hero section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left - Main info */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card glass borderGradient>
              <div className="relative h-56 rounded-t-xl bg-gradient-to-br from-accent/15 via-transparent to-secondary/10 flex items-center justify-center">
                <Building2 size={60} className="text-muted/20" />
                <Badge
                  variant="score"
                  size="lg"
                  className="absolute top-4 right-4"
                  style={{
                    borderColor: "rgba(16, 185, 129, 0.3)",
                    color: "#10b981",
                    fontSize: "1rem",
                    padding: "0.5rem 1rem",
                  }}
                >
                  {analysis.investmentScore}
                </Badge>
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <Button size="sm" variant="glass">
                    <Phone size={14} />
                    Zavolat
                  </Button>
                  <Button size="sm" variant="glass">
                    <Share2 size={14} />
                  </Button>
                  <Button size="sm" variant="glass">
                    <Star size={14} />
                  </Button>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h1 className="text-xl font-bold">{property.title}</h1>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted">
                    <MapPin size={14} />
                    {property.address}
                    <span>·</span>
                    <Clock size={14} />
                    14 dní na trhu
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <DollarSign size={18} className="text-secondary" />
                    <div>
                      <p className="text-2xl font-bold">{formatPrice(property.price)}</p>
                      <p className="text-xs text-muted">
                        {property.pricePerSqm.toLocaleString()} Kč/m²
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold">{property.rooms}</p>
                      <p className="text-xs text-muted">dispozice</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{property.area}</p>
                      <p className="text-xs text-muted">m²</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{property.floor}.</p>
                      <p className="text-xs text-muted">patro</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{property.condition}</p>
                      <p className="text-xs text-muted">stav</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{property.yearBuilt}</p>
                      <p className="text-xs text-muted">rok</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="info">{property.portalName}</Badge>
                  <Badge variant="outline">ID: {property.id}</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Description */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base">Popis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted">{property.description}</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Price History */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base">Historie cen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {property.priceHistory.map((ph, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-card-hover">
                      <span className="text-sm">{ph.date}</span>
                      <span className="font-semibold">{formatPrice(ph.price)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right - Analysis & Calculator */}
        <div className="space-y-6">
          {/* Investment Score */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card glass borderGradient>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target size={16} className="text-accent" />
                  Investiční analýza
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Tržní hodnota</span>
                  <span className="font-semibold">{formatPrice(analysis.marketValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Podhodnocení</span>
                  <span className="font-semibold text-success">
                    {analysis.undervaluationPct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">ARV (po rekonstrukci)</span>
                  <span className="font-semibold">{formatPrice(analysis.arv)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Odhadovaný zisk</span>
                  <span className="font-semibold text-secondary">
                    {formatPrice(analysis.netProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">ROI</span>
                  <span className="font-semibold text-success">{analysis.roi.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Annualized ROI</span>
                  <span className="font-semibold">{analysis.annualizedRoi.toFixed(1)}%</span>
                </div>

                <div className="pt-2">
                  <Badge
                    variant="success"
                    size="lg"
                    className="w-full justify-center py-1.5 text-sm"
                  >
                    <CheckCircle2 size={14} className="mr-1" />
                    DOPORUČENO K INVESTICI
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Flip Calculator */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card glass>
              <CardHeader
                className="cursor-pointer flex flex-row items-center justify-between"
                onClick={() => setCalcOpen(!calcOpen)}
              >
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={16} className="text-secondary" />
                  Kalkulátor
                </CardTitle>
                {calcOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </CardHeader>
              {calcOpen && (
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Kupní cena</label>
                    <Input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Rozsah rekonstrukce</label>
                    <div className="flex gap-1">
                      {(["light", "medium", "full"] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setRenoLevel(level)}
                          className={`flex-1 py-2 text-xs rounded-lg border transition-all ${
                            renoLevel === level
                              ? "border-accent bg-accent/20 text-accent"
                              : "border-border text-muted hover:border-accent/30"
                          }`}
                        >
                          {level === "light"
                            ? "Lehká"
                            : level === "medium"
                              ? "Střední"
                              : "Kompletní"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2 text-sm">
                    <div className="flex justify-between text-muted">
                      <span>Rekonstrukce</span>
                      <span>{formatPrice(analysis.renovationCost)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Právní + daň (8 %)</span>
                      <span>{formatPrice(Math.round(purchasePrice * 0.08))}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Rezerva (10 %)</span>
                      <span>{formatPrice(Math.round(analysis.renovationCost * 0.1))}</span>
                    </div>
                    <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                      <span>Celkové náklady</span>
                      <span>
                        {formatPrice(
                          purchasePrice +
                            analysis.renovationCost +
                            Math.round(purchasePrice * 0.08) +
                            Math.round(analysis.renovationCost * 0.1)
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>

          {/* AI Report */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card glass>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText size={16} className="text-warning" />
                  AI Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted leading-relaxed">{analysis.aiReport.summary}</p>

                {analysis.aiReport.negotiationTips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-secondary mb-1">Vyjednávací tipy</p>
                    <ul className="space-y-1">
                      {analysis.aiReport.negotiationTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted">
                          <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.aiReport.hiddenInfo.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-warning mb-1">Skryté informace</p>
                    <ul className="space-y-1">
                      {analysis.aiReport.hiddenInfo.map((info, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted">
                          <AlertTriangle size={12} className="text-warning mt-0.5 shrink-0" />
                          {info}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
