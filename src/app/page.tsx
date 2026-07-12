"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { ScoreGauge } from "@/components/ui/score-gauge";
import {
  MagnifyingGlass,
  ChartLineUp,
  Bell,
  Phone,
  GitBranch,
  Calculator,
  ArrowRight,
  House,
} from "@phosphor-icons/react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } },
};

function MagneticButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xSpring = useSpring(x, { stiffness: 100, damping: 15 });
  const ySpring = useSpring(y, { stiffness: 100, damping: 15 });

  const handleMouse = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    x.set(dx * 0.2);
    y.set(dy * 0.2);
  };

  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      style={{ x: xSpring, y: ySpring }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const features = [
  {
    icon: MagnifyingGlass,
    title: "Scraping 10+ portálů",
    desc: "Sledujeme Sreality, Bezrealitky, Remax, Century21 a další. Nové inzeráty máte v minutách.",
    size: "lg",
  },
  {
    icon: ChartLineUp,
    title: "AI analýza",
    desc: "GPT-4o vyhodnotí podhodnocení, ARV, ziskovost a rizika.",
    size: "sm",
  },
  {
    icon: GitBranch,
    title: "Pipeline management",
    desc: "Kanban board pro celý proces od nového leadu po uzavřený deal.",
    size: "sm",
  },
  {
    icon: Phone,
    title: "Call Mode",
    desc: "Rozhraní pro telefonování s detailem, scriptem a SMS šablonami.",
    size: "md",
  },
  {
    icon: Bell,
    title: "Chytré alerty",
    desc: "Upozornění na cenové skoky a podhodnocené nabídky v reálném čase.",
    size: "sm",
  },
  {
    icon: Calculator,
    title: "Flip kalkulačka",
    desc: "Spočítejte marži, cash-on-cash, annualizované ROI a break-even.",
    size: "md",
  },
];

const sizeClasses: Record<string, string> = {
  lg: "col-span-2 row-span-2 min-h-[320px]",
  md: "col-span-2 min-h-[240px]",
  sm: "min-h-[240px]",
};

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh]">
      {/* Nav */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 lg:px-10 h-16"
      >
        <div className="rounded-xl bg-card border border-border/50 px-4 py-2 flex items-center gap-3">
          <House size={20} weight="fill" className="text-accent" />
          <span className="font-semibold text-sm tracking-tight">RealFlip</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-muted hover:text-foreground transition-colors px-4 py-2"
          >
            Přihlásit
          </Link>
          <Link
            href="/register"
            className="relative inline-flex items-center justify-center whitespace-nowrap rounded-full bg-accent text-white text-sm font-medium h-9 px-5 hover:bg-accent-hover active:scale-[0.98] transition-all duration-200"
          >
            Zdarma
          </Link>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/20 px-4 py-1.5 mb-6"
              >
                <span className="w-2 h-2 rounded-full bg-accent pulse-dot" />
                <span className="text-xs text-accent font-medium">
                  10+ napojených realitních portálů
                </span>
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tighter leading-none mb-6">
                Najdete podhodnocené
                <br />
                <span className="text-accent">nemovitosti</span> dřív
                <br />
                než konkurence
              </h1>
              <p className="text-base text-muted leading-relaxed max-w-[65ch] mb-8">
                RealFlip Pro sleduje české realitní portály v reálném čase, analyzuje
                každý inzerát pomocí AI a ukáže vám jen ty nejziskovější příležitosti
                k investici.
              </p>
              <div className="flex items-center gap-4">
                <MagneticButton>
                  <Link
                    href="/register"
                    className="relative inline-flex items-center justify-center whitespace-nowrap rounded-full bg-accent text-white font-medium h-12 px-7 text-base hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 gap-2"
                  >
                    Vyzkoušet zdarma
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </MagneticButton>
                <Link
                  href="/login"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Ukázkový účet
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              className="relative"
            >
              <div className="rounded-2xl border border-border/50 bg-card p-8 lg:p-10 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-accent/10 rounded-full blur-3xl" />
                <div className="space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-xs text-muted font-mono">dashboard</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Byt 3+kk, Praha 8", price: "4.890.000 Kč", score: 82, change: "+19%" },
                      { label: "Byt 2+kk, Ostrava", price: "2.890.000 Kč", score: 91, change: "+33%" },
                      { label: "RD, Brno", price: "7.250.000 Kč", score: 74, change: "+12%" },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex items-center justify-between rounded-xl bg-card-hover border border-border/50 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <ScoreGauge score={item.score} size={28} strokeWidth={2.5} />
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted">{item.price}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-accent font-mono">{item.change}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Bento */}
      <section className="py-20 lg:py-28">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <span className="text-xs text-accent font-medium uppercase tracking-wider">Funkce</span>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">
              Vše, co investor potřebuje
            </h2>
            <p className="text-muted mt-2 max-w-[65ch]">
              Od scrapování po prodej — jeden nástroj pokryje celý životní cyklus realitní investice.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                className={`${sizeClasses[f.size]} rounded-2xl border border-border/50 bg-card p-8 hover:bg-card-hover transition-colors duration-300 flex flex-col`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 mb-5">
                  <f.icon size={20} className="text-accent" weight="duotone" />
                </div>
                <h3 className="font-semibold tracking-tight mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed flex-1">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border/50 bg-card p-10 lg:p-16 text-center relative overflow-hidden"
          >
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
                Začněte investovat chytřeji
              </h2>
              <p className="text-muted max-w-[60ch] mx-auto mb-8">
                14 dní zdarma, žádná kreditní karta. Během pár minut máte přehled o
                všech podhodnocených nemovitostech na trhu.
              </p>
              <MagneticButton>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full bg-accent text-white font-medium h-12 px-8 text-base hover:bg-accent-hover active:scale-[0.98] transition-all duration-200 gap-2"
                >
                  Vytvořit účet zdarma
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </MagneticButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <House size={16} weight="fill" className="text-accent" />
            <span className="text-sm text-muted">RealFlip Pro</span>
          </div>
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} RealFlip Pro. Všechna práva vyhrazena.
          </p>
        </div>
      </footer>
    </div>
  );
}
