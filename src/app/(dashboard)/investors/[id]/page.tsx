import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { investors, deals, properties, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { formatInvestorBudget } from "@/lib/investors";
import { EditInvestorButton } from "@/components/investors/edit-investor-button";
import { ArrowLeft, Phone, Envelope, MapPin, Infinity as InfinityIcon, Folder } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = { purchased: "Koupeno", renovating: "Rekonstrukce", selling: "Na prodej", sold: "Prodáno" };
const statusColor: Record<string, "info" | "warning" | "success"> = { purchased: "info", renovating: "warning", selling: "info", sold: "success" };

export default async function InvestorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const investor = await db
    .select()
    .from(investors)
    .where(eq(investors.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!investor) notFound();

  const projects = await db
    .select({
      dealId: deals.id,
      status: deals.status,
      purchasePrice: deals.purchasePrice,
      purchaseDate: deals.purchaseDate,
      propertyId: properties.id,
      propertyTitle: properties.title,
      propertyAddress: properties.address,
      arv: propertyAnalysis.arv,
    })
    .from(deals)
    .leftJoin(properties, eq(deals.propertyId, properties.id))
    .leftJoin(propertyAnalysis, eq(deals.propertyId, propertyAnalysis.propertyId))
    .where(eq(deals.investorId, id))
    .orderBy(desc(deals.purchaseDate));

  return (
    <div className="space-y-6">
      <Link href="/investors" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
        <ArrowLeft size={14} weight="bold" />
        Zpět na investory
      </Link>

      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-lg font-mono font-medium">
            {(investor.name ?? "??").split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">{investor.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {investor.budgetUnlimited ? (
                <Badge variant="default" size="sm" className="gap-1">
                  <InfinityIcon size={12} weight="fill" />
                  Neomezeno
                </Badge>
              ) : (
                <Badge variant="secondary" size="sm">
                  {formatInvestorBudget(investor.budget, investor.budgetUnlimited)}
                </Badge>
              )}
              {investor.city && (
                <span className="text-xs text-muted flex items-center gap-1">
                  <MapPin size={12} weight="bold" />
                  {investor.city}
                </span>
              )}
            </div>
          </div>
          <EditInvestorButton investor={{
            id: investor.id,
            name: investor.name,
            city: investor.city,
            phone: investor.phone,
            email: investor.email,
            budget: investor.budget,
            budgetUnlimited: investor.budgetUnlimited,
            notes: investor.notes,
          }} />
        </div>

        <div className="space-y-2 text-sm mt-4">
          {investor.phone && (
            <div className="flex items-center gap-2 text-muted">
              <Phone size={14} weight="bold" />
              <a href={`tel:${investor.phone.replace(/\s/g, "")}`} className="text-accent hover:underline">{investor.phone}</a>
            </div>
          )}
          {investor.email && (
            <div className="flex items-center gap-2 text-muted">
              <Envelope size={14} weight="bold" />
              <a href={`mailto:${investor.email}`} className="text-accent hover:underline">{investor.email}</a>
            </div>
          )}
        </div>

        {investor.notes && (
          <p className="text-sm text-muted mt-4 leading-relaxed">{investor.notes}</p>
        )}
      </div>

      <div>
        <h2 className="font-semibold tracking-tight mb-4 flex items-center gap-2">
          <Folder size={16} weight="duotone" className="text-accent" />
          Projekty ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
            <p className="text-sm text-muted">Tento investor zatím nemá žádné projekty.</p>
            <p className="text-xs text-muted mt-1">Přiřadit investora lze při převodu leadu na deal v pipeline.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-4 text-xs text-muted font-medium">Nemovitost</th>
                    <th className="text-right p-4 text-xs text-muted font-medium">Kupní cena</th>
                    <th className="text-right p-4 text-xs text-muted font-medium">ARV</th>
                    <th className="text-right p-4 text-xs text-muted font-medium">Stav</th>
                    <th className="text-right p-4 text-xs text-muted font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {projects.map((p) => (
                    <tr key={p.dealId} className="hover:bg-card-hover transition-colors">
                      <td className="p-4">
                        <p className="font-medium truncate max-w-[280px]">{p.propertyTitle ?? "Neznámá nemovitost"}</p>
                        {p.propertyAddress && <p className="text-xs text-muted truncate max-w-[280px]">{p.propertyAddress}</p>}
                      </td>
                      <td className="p-4 text-right font-mono">{p.purchasePrice ? `${p.purchasePrice.toLocaleString("cs-CZ")} Kč` : "—"}</td>
                      <td className="p-4 text-right font-mono">{p.arv ? `${p.arv.toLocaleString("cs-CZ")} Kč` : "—"}</td>
                      <td className="p-4 text-right">
                        <Badge variant={statusColor[p.status] ?? "secondary"} size="sm">
                          {statusLabel[p.status] ?? p.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {p.propertyId && (
                          <Link href={`/portfolio/${p.dealId}`} className="text-xs text-accent hover:underline">
                            Detail
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
