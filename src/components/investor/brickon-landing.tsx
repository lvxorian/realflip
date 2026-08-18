"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  SealCheck,
  DoorOpen,
  MagnifyingGlass,
  ChartLineUp,
  Gavel,
  CalendarCheck,
  LockSimple,
  Handshake,
  Coins,
} from "@phosphor-icons/react";
import { BrickonLogo } from "@/components/investor/brickon-logo";
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold tracking-tight">Praha 3 · Žižkov</p>
                      <p className="text-xs text-muted mt-0.5">2+1 · 89 m² · Stav: Před rekonstrukcí</p>
                    </div>
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent">
                      Dostupná
                    </span>
                  </div>
                  <div className="mt-4 divide-y divide-border/30">
                    {[
                      { label: "Inzerovaná cena", value: "13,69 mil. Kč", muted: true },
                      { label: "Cena po vyjednání", value: "11,5 mil. Kč", strong: true },
                      { label: "Sleva oproti inzerci", value: "−16,0 %", accent: true },
                      { label: "Odhadovaný zisk", value: "1,25 mil. Kč", accent: true },
                      { label: "ROI", value: "+10,8 %", accent: true },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-2">
                        <span className="text-xs text-muted">{row.label}</span>
                        <span
                          className={`font-mono text-sm font-semibold ${
                            row.accent ? "text-emerald-400" : row.strong ? "text-foreground" : "text-muted"
                          }`}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <SealCheck size={15} weight="bold" />
                    Rezervovat
                  </button>
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
                "Denní monitoring inzerce, dražeb i off-market zdrojů",
                "U každé nabídky vyjednaná sleva včetně finančního odhadu",
                "Dva modely spolupráce dle vašeho výběru",
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
                  { icon: <ChartLineUp size={20} weight="bold" />, title: "Dodáváme analýzu a odhad", text: "Ke každé nabídce připravíme přehled s odhadem zisku, návratnosti a doporučeným dalším krokem." },
                  { icon: <CalendarCheck size={20} weight="bold" />, title: "Postaráme se o realizaci", text: "Zajistíme zprostředkování či koupi, rekonstrukci a následný prodej nemovitosti. Od podpisu až po předání klíčů." },
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
                    text: "Investor financuje nákup a náklady, my zajišťujeme vyjednávání, zprostředkování i realizaci projektu. Zisk si dělíme rovným dílem.",
                  },
                  {
                    title: "Sourcing fee",
                    icon: <Coins size={20} weight="bold" />,
                    text: "Najdeme vhodnou nemovitost a vyjednáme slevu. O následnou rekonstrukci, prodej či pronájem se stará investor. Za zprostředkování nám plátíte předem domluvenou sazbu.",
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
                <div className="brick-cube-wrap mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                  <div className="brick-cube">
                    <div className="brick-face brick-front">
                      <BrickonLogo size={40} tone="light" />
                    </div>
                    <div className="brick-face brick-back" />
                    <div className="brick-face brick-left" />
                    <div className="brick-face brick-right" />
                    <div className="brick-face brick-top" />
                    <div className="brick-face brick-bottom" />
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Připraveni investovat s námi?</h2>
                <p className="mt-3 text-sm text-muted">
                  Vstupte do portálu {INVESTOR_BRAND} a prohlédněte si aktuální nabídky s vyjednanou slevou.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Link
                    href="/investor/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
                  >
                    <DoorOpen size={16} weight="bold" />
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
