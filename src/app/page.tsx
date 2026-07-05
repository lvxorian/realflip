import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, BarChart3, Phone, Zap, Shield } from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Scraping 10+ portálů",
    desc: "Automatický sběr dat z největších realitních portálů v ČR v reálném čase.",
    color: "text-accent",
  },
  {
    icon: TrendingUp,
    title: "AI analýza",
    desc: "GPT-4o vyhodnocuje investiční potenciál, odhaluje skryté informace a navrhuje strategii.",
    color: "text-secondary",
  },
  {
    icon: BarChart3,
    title: "Tržní intelligence",
    desc: "Cenové trendy, comparables, sezónnost a heatmapy příležitostí.",
    color: "text-info",
  },
  {
    icon: Phone,
    title: "Call Mode",
    desc: "Automatický dialer s vyjednávacími scénáři a sledováním konverzí.",
    color: "text-success",
  },
  {
    icon: Zap,
    title: "Pipeline management",
    desc: "Kanban board, CRM kontaktů a automatické alerty na price dropy.",
    color: "text-warning",
  },
  {
    icon: Shield,
    title: "Flip kalkulátor",
    desc: "Detailní výpočet ARV, ROI, break-even ceny a cash-on-cash return.",
    color: "text-accent",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Noise overlay */}
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 border border-accent/30">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
            RealFlip Pro
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Přihlásit se</Button>
          </Link>
          <Link href="/register">
            <Button variant="default">Zdarma vyzkoušet</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-3xl space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10 text-sm text-accent">
            <Zap size={14} />
            Profesionální nástroj pro realitní investory
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
            Najděte{" "}
            <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
              podhodnocené
            </span>{" "}
            nemovitosti dřív než konkurence
          </h1>

          <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            RealFlip Pro automaticky scrapuje 10+ realitních portálů, analyzuje investiční potenciál pomocí AI
            a pomáhá vám řídit celý flip proces od nálezu po prodej.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="xl" variant="default">
                Začít zdarma
                <svg className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
            </Link>
            <Button size="xl" variant="glass">
              Podívat se na video
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-muted">
            <span>🔒 Zdarma po dobu 14 dní</span>
            <span>⚡ Bez platební karty</span>
            <span>🇨🇿 České portály</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 hover:border-accent/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-card-hover border border-border mb-4 group-hover:border-accent/30 transition-colors`}>
                  <Icon size={22} className={feature.color} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-secondary/5 p-12">
          <h2 className="text-3xl font-bold mb-4">
            Připraveni najít váš další flip?
          </h2>
          <p className="text-muted mb-8 max-w-lg mx-auto">
            Začněte zdarma ještě dnes. Žádná platební karta, žádné závazky.
          </p>
          <Link href="/register">
            <Button size="xl" variant="secondary">
              Vytvořit účet zdarma
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted">
          <p>© 2026 RealFlip Pro. Všechna práva vyhrazena.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Přihlásit</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Registrovat</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
