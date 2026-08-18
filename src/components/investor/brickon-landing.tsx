"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  SealCheck,
  HandCoins,
  MagnifyingGlass,
  ChartLineUp,
  Gavel,
  CalendarCheck,
  LockSimple,
  Handshake,
  Coins,
} from "@phosphor-icons/react";
import { BrickonLogo } from "@/components/investor/brickon-logo";
import { PropertyImage } from "@/components/ui/property-image";
import { Badge } from "@/components/ui/badge";
import { INVESTOR_BRAND } from "@/lib/investor-brand";

const item = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 110, damping: 20 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function BrickonLanding() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="bg-grid min-h-[100dvh]">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-card/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/25 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
              <BrickonLogo size={30} tone="brand" />
            </div>
            <p className="text-lg font-semibold tracking-tight uppercase leading-none">{INVESTOR_BRAND}</p>
            <div className="flex-1" />
            <Link
              href="/investor/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              <LockSimple size={15} weight="bold" />
              Vstoupit do portálu
            </Link>
          </div>
        </header>

        <main>
          {/* Hero */}
          <section className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-24 pb-16">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <motion.div initial="hidden" animate="visible" variants={stagger}>
                <motion.p
                  variants={item}
                  className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                >
                  <SealCheck size={13} weight="bold" />
                  Prověřené nabídky pro soukromé investory
                </motion.p>
                <motion.h1
                  variants={item}
                  className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]"
                >
                  Váš portál do světa
                  <br />
                  <span className="text-accent">realitního investování.</span>
                </motion.h1>
                <motion.p variants={item} className="mt-5 max-w-lg text-muted leading-relaxed">
                  Denně sledujeme více než 10 realitních portálů, dražby i nabídky mimo veřejnou inzerci. Každou zajímavou
                  nemovitost prověříme, vyjednáme a předáme vám s jasnou analýzou zisku, návratnosti a dalšího postupu.
                </motion.p>
                <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/investor/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
                  >
                    Vstoupit do portálu
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                  <span className="text-xs text-muted">Přístupové údaje obdržíte od našeho týmu.</span>
                </motion.div>
              </motion.div>

              {/* Hero mockup */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-accent/15 via-transparent to-emerald-500/10 blur-2xl" />
                <div className="glass-strong relative rounded-2xl border border-border/50 p-5">
                  <div className="relative overflow-hidden rounded-xl border border-border/50">
                    <PropertyImage
                      src="https://st.realitymix.cz/i/66675202/8545101/nab_485877793.jpg"
                      alt="Byt 2+1 před rekonstrukcí, Praha 3 · Žižkov"
                      containerClassName="aspect-[8/5]"
                    />
                    <span className="absolute top-2 left-2 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Flip
                    </span>
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" size="sm">Dostupná</Badge>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="font-semibold leading-tight">Praha 3 · Žižkov</p>
                    <p className="text-xs text-muted mt-1">2+1 · 89 m² · Stav: Před rekonstrukcí</p>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/40 bg-card-subtle/60 px-3.5 py-3 space-y-1.5">
                    <PriceRow label="Inzerovaná cena" value="10 990 000 Kč" perSqm="113 299 Kč/m²" />
                    <PriceRow label="Cena po vyjednání" value="4 500 000 Kč" perSqm="46 392 Kč/m²" big />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-muted">Úspora oproti inzerci</span>
                      <span className="text-xs font-mono text-emerald-400 tabular-nums font-semibold">−59,1 %</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/40 bg-card-subtle/60 px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Model 50/50</p>
                      <p className="text-[10px] text-muted mt-0.5">váš zisk · polovina obchodu</p>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <p className="font-mono text-base font-semibold tabular-nums text-emerald-400">674 895 Kč</p>
                        <Handshake size={24} weight="bold" className="text-accent/20 shrink-0 mb-0.5" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-card-subtle/60 px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Model Sourcing fee</p>
                      <p className="text-[10px] text-muted mt-0.5">váš zisk · po rekonstrukci</p>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <p className="font-mono text-base font-semibold tabular-nums text-emerald-400">1 270 790 Kč</p>
                        <Coins size={24} weight="bold" className="text-accent/20 shrink-0 mb-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-emerald-400">Dostupná k rezervaci</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <SealCheck size={15} weight="bold" />
                      Rezervovat
                    </button>
                  </div>
                  <p className="mt-3 text-center text-[10px] text-muted">Ilustrativní náhled portálu</p>
                </div>
              </motion.div>
            </div>

            {/* Trust strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4 }}
              className="mt-16 grid gap-2 sm:grid-cols-3"
            >
              {[
                "Denní monitoring 10+ portálů, dražeb i off-market zdrojů",
                "Vyjednané slevy u každé nabídky",
                "U každé nabídky analýza zisku, ROI a dalšího kroku",
              ].map((text) => (
                <div
                  key={text}
                  className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-3 py-2.5 text-[11px] text-muted"
                >
                  <CheckDot />
                  {text}
                </div>
              ))}
            </motion.div>
          </section>

          {/* Jak to funguje */}
          <section className="border-t border-border/40 py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                className="text-center"
              >
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Jak to funguje</h2>
                <p className="mt-2 text-sm text-muted">Od prvního signálu po první rezervaci a návrh dalšího kroku.</p>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={stagger}
                className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                {[
                  { icon: <MagnifyingGlass size={20} weight="bold" />, title: "Sledujeme trh nepřetržitě", text: "Procházíme realitní portály, dražby i off-market zdroje a identifikujeme nabídky se ziskovým potenciálem." },
                  { icon: <Gavel size={20} weight="bold" />, title: "Vyjednáváme za vás", text: "Osobně jednáme s prodávajícími tak, aby pro vás zůstala dostatečná rezerva na zisk." },
                  { icon: <ChartLineUp size={20} weight="bold" />, title: "Dodáváme analýzu a report", text: "Ke každé nabídce připravíme přehled s odhadem zisku, návratnosti a doporučeným dalším krokem." },
                  { icon: <CalendarCheck size={20} weight="bold" />, title: "Postaráme se o realizaci", text: "Zajistíme koupi, rekonstrukci i další prodej nebo pronájem — od podpisu až po předání klíčů." },
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    variants={item}
                    className="rounded-2xl border border-border/50 bg-card p-5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/25 text-accent">
                      {step.icon}
                    </div>
                    <p className="mt-4 text-[11px] font-medium text-muted">Krok {i + 1}</p>
                    <p className="mt-0.5 font-semibold tracking-tight">{step.title}</p>
                    <p className="mt-1.5 text-sm text-muted leading-relaxed">{step.text}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Modely spolupráce */}
          <section className="border-t border-border/40 py-16">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                className="text-center"
              >
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Spolupracujeme ve dvou modelech</h2>
                <p className="mt-2 text-sm text-muted">Vyberte si úroveň spolupráce — od kompletního servisu po čistý sourcing.</p>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={stagger}
                className="mt-10 grid gap-4 md:grid-cols-2"
              >
                {[
                  {
                    title: "50/50",
                    icon: <Handshake size={20} weight="bold" />,
                    text: "Investor financuje nákup a náklady, my zajišťujeme sourcing, jednání i realizaci projektu. Zisk si dělíme rovným dílem.",
                  },
                  {
                    title: "Sourcing fee",
                    icon: <Coins size={20} weight="bold" />,
                    text: "Najdeme a vyjednáme pro vás obchod s reálnou slevou. Rekonstrukci i pronájem si řešíte sami. Model pro samostatné investory.",
                  },
                ].map((plan) => (
                  <motion.div
                    key={plan.title}
                    variants={item}
                    className="rounded-2xl border border-border/50 bg-card p-6"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 border border-accent/25 text-accent">
                      {plan.icon}
                    </div>
                    <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-muted">{plan.title}</p>
                    <p className="mt-3 text-sm leading-relaxed text-foreground/90">{plan.text}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* CTA */}
          <section className="border-t border-border/40 py-16">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
              >
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/15 border border-accent/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                  <BrickonLogo size={52} tone="light" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Připraveni investovat?</h2>
                <p className="mt-3 text-sm text-muted">
                  Vstupte do portálu {INVESTOR_BRAND} a prohlédněte si aktuální nabídky s vyjednanou slevou.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Link
                    href="/investor/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
                  >
                    <HandCoins size={16} weight="bold" />
                    Vstoupit do portálu
                  </Link>
                  <span className="text-xs text-muted">Přístupové údaje obdržíte od našeho týmu.</span>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border/40 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 sm:flex-row sm:justify-between sm:px-6">
            <p className="text-sm font-semibold tracking-tight uppercase">{INVESTOR_BRAND}</p>
            <p className="text-xs text-muted">{INVESTOR_BRAND} · Soukromý investorský portál · © {new Date().getFullYear()}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CheckDot() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
      <SealCheck size={11} weight="bold" />
    </span>
  );
}

function PriceRow({
  label,
  value,
  perSqm,
  big,
}: {
  label: string;
  value: string;
  perSqm: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-muted leading-snug">{label}</span>
      <span className="text-right">
        <span
          className={`block font-mono tabular-nums whitespace-nowrap ${
            big ? "text-lg font-semibold text-amber-400" : "text-xs text-muted"
          }`}
        >
          {value}
        </span>
        <span className="block text-[10px] font-mono text-muted/50 tabular-nums whitespace-nowrap">{perSqm}</span>
      </span>
    </div>
  );
}
