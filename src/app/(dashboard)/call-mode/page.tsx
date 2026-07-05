"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOff,
  MapPin,
  DollarSign,
  Target,
  Building2,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  FileText,
  User,
  SkipForward,
} from "lucide-react";

interface CallItem {
  id: string;
  title: string;
  address: string;
  price: number;
  score: number;
  contactName: string;
  contactPhone: string;
  contactType: string;
  rooms: string;
  area: number;
  condition: string;
  notes: string;
}

const callQueue: CallItem[] = [
  {
    id: "1",
    title: "Byt 3+kk, Praha 8 – Karlín",
    address: "Sokolovská 123, Praha 8",
    price: 4890000,
    score: 82,
    contactName: "Jan Novák",
    contactPhone: "+420 777 123 456",
    contactType: "Makléř (RE/MAX)",
    rooms: "3+kk",
    area: 50,
    condition: "Původní stav",
    notes: "Cena již 2x snížena. Prodejce motivovaný – dědictví. Možnost rychlého uzavření.",
  },
  {
    id: "2",
    title: "Byt 2+kk, Ostrava – Poruba",
    address: "Hlavní třída 789, Ostrava",
    price: 2890000,
    score: 91,
    contactName: "Petr Svoboda",
    contactPhone: "+420 602 987 654",
    contactType: "Majitel",
    rooms: "2+kk",
    area: 45,
    condition: "Po rekonstrukci",
    notes: "Nízká cena oproti trhu. Majitel prodává kvůli stěhování do důchodu.",
  },
  {
    id: "3",
    title: "Rodinný dům, Brno – Královo Pole",
    address: "Božetěchova 45, Brno",
    price: 7250000,
    score: 74,
    contactName: "Marie Dvořáková",
    contactPhone: "+420 731 456 789",
    contactType: "Makléř (Century21)",
    rooms: "4+1",
    area: 100,
    condition: "Dobrý stav",
    notes: "Dům po částečné rekonstrukci. Lokalita s rostoucím trendem.",
  },
];

const callScript = `1. Představení
"Dobrý den, jmenuji se [Vaše jméno] z RealFlip Investments. Volám ohledně inzerátu na [adresa]."

2. Kvalifikace
"Je nemovitost stále k dispozici?"
"Jaká je Vaše časová preference prodeje?"
"Jednáte s někým dalším?"

3. Vyjednávání
"Cena byla nedávno snížena, jaká je Vaše nejnižší možná cena?"
"Jsme připraveni jednat rychle – hotovost, bez hypotéky."

4. Uzavření
"Můžeme se domluvit na prohlídce tento týden?"
"Kdy Vám to nejvíce vyhovuje?"`;

const smsTemplate = "Dobrý den, volal jsem ohledně Vašeho inzerátu na [adresa]. Mám zájem o prohlídku. Kdy by Vám to vyhovovalo? Děkuji, [Jméno]";

export default function CallModePage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [copied, setCopied] = useState(false);

  const current = callQueue[currentIndex];
  const hasNext = currentIndex < callQueue.length - 1;

  function handleCall() {
    setCallActive(true);
    // In production: window.location.href = `tel:${current.contactPhone}`;
    setTimeout(() => {
      setCallActive(false);
      setShowOutcome(true);
    }, 3000);
  }

  function handleOutcome(outcome: string) {
    setShowOutcome(false);
    if (hasNext) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Call Mode</h1>
          <p className="text-muted text-sm mt-1">
            {currentIndex + 1} z {callQueue.length} ve frontě
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Dnes: 5 hovorů</Badge>
          <Badge variant="success">67% conversion</Badge>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="flex-1 grid gap-4 lg:grid-cols-3"
        >
          {/* Left - Property Details */}
          <Card glass className="overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 size={16} className="text-accent" />
                Detail nemovitosti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-32 rounded-lg bg-gradient-to-br from-accent/10 to-secondary/5 flex items-center justify-center">
                <Building2 size={40} className="text-muted/30" />
              </div>
              <div>
                <h3 className="font-semibold">{current.title}</h3>
                <div className="flex items-center gap-1 text-xs text-muted mt-1">
                  <MapPin size={12} />
                  {current.address}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <DollarSign size={16} className="text-secondary" />
                  <span className="font-bold text-lg">
                    {(current.price / 1000000).toFixed(1)} mil.
                  </span>
                </div>
                <Badge
                  variant="score"
                  style={{
                    borderColor: "rgba(16, 185, 129, 0.3)",
                    color: "#10b981",
                  }}
                >
                  {current.score}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-card-hover">
                  <p className="font-semibold text-sm">{current.rooms}</p>
                  <p className="text-muted">dispozice</p>
                </div>
                <div className="p-2 rounded-lg bg-card-hover">
                  <p className="font-semibold text-sm">{current.area}</p>
                  <p className="text-muted">m²</p>
                </div>
                <div className="p-2 rounded-lg bg-card-hover">
                  <p className="font-semibold text-sm">{current.condition}</p>
                  <p className="text-muted">stav</p>
                </div>
              </div>
              {current.notes && (
                <div>
                  <p className="text-xs font-semibold text-warning mb-1">Poznámka</p>
                  <p className="text-xs text-muted">{current.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Center - Call Action */}
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-sm text-muted mb-2">Nyní voláte</p>
              <p className="text-lg font-bold">{current.contactName}</p>
              <p className="text-sm text-muted">{current.contactType}</p>
            </div>

            <div className="relative">
              <motion.div
                animate={callActive ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 rounded-full bg-accent/20"
              />
              <Button
                variant={callActive ? "danger" : "default"}
                size="xl"
                className="relative h-20 w-20 rounded-full z-10"
                onClick={callActive ? () => { setCallActive(false); setShowOutcome(true); } : handleCall}
              >
                {callActive ? <PhoneOff size={28} /> : <Phone size={28} />}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted">
              <Phone size={14} />
              <a href={`tel:${current.contactPhone}`} className="hover:text-accent transition-colors">
                {current.contactPhone}
              </a>
            </div>

            {!callActive && showOutcome && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm space-y-2"
              >
                <p className="text-center text-sm text-muted">Výsledek hovoru</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Nezvedá", icon: PhoneOff, color: "text-muted" },
                    { label: "Volat znovu", icon: Clock, color: "text-info" },
                    { label: "Nezájem", icon: XCircle, color: "text-danger" },
                    { label: "Zájem", icon: CheckCircle2, color: "text-success" },
                  ].map((opt) => (
                    <Button
                      key={opt.label}
                      variant="outline"
                      size="sm"
                      className="flex-col gap-1 h-16"
                      onClick={() => handleOutcome(opt.label)}
                    >
                      <opt.icon size={16} className={opt.color} />
                      <span className="text-xs">{opt.label}</span>
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {hasNext && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentIndex(currentIndex + 1);
                  setShowOutcome(false);
                }}
              >
                <SkipForward size={14} />
                Přeskočit
              </Button>
            )}
          </div>

          {/* Right - Script & Tools */}
          <Card glass className="overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} className="text-secondary" />
                Cheatsheet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact Info */}
              <div className="space-y-2 p-3 rounded-lg bg-card-hover">
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-accent" />
                  <span className="font-medium">{current.contactName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-secondary" />
                  <span>{current.contactPhone}</span>
                </div>
                <div className="text-xs text-muted">{current.contactType}</div>
              </div>

              {/* Call Script */}
              <div>
                <p className="text-xs font-semibold mb-2">Scénář hovoru</p>
                <pre className="text-xs text-muted whitespace-pre-wrap font-sans leading-relaxed">
                  {callScript}
                </pre>
              </div>

              {/* SMS Template */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">SMS šablona</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyToClipboard(smsTemplate)}
                  >
                    {copied ? (
                      <CheckCircle2 size={14} className="text-success" />
                    ) : (
                      <MessageSquare size={14} />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted p-2 rounded-lg bg-card-hover">
                  {smsTemplate}
                </p>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold mb-2">Poznámky</p>
                <textarea
                  className="w-full h-20 rounded-lg bg-card-hover border border-border p-2 text-xs resize-none focus:outline-none focus:border-accent/50"
                  placeholder="Zapište poznámky z hovoru..."
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
