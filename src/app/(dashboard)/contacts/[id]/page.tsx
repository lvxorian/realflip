import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { contacts, leads, properties, propertyAnalysis } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { conditionLabel } from "@/lib/utils";
import { ArrowLeft, Phone, Envelope } from "@phosphor-icons/react/dist/ssr";

const stageLabels: Record<string, string> = {
  new: "Nový",
  contacted: "Kontaktován",
  meeting: "Schůzka",
  offer: "Nabídka",
  negotiation: "Vyjednávání",
  closed: "Uzavřeno",
  lost: "Ztraceno",
};

const stageColors: Record<string, string> = {
  new: "text-accent",
  contacted: "text-blue-400",
  meeting: "text-amber-400",
  offer: "text-emerald-400",
  negotiation: "text-emerald-500",
  closed: "text-emerald-600",
  lost: "text-red-400",
};

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!contact) notFound();

  const contactLeads = await db
    .select({
      leadId: leads.id,
      stage: leads.stage,
      updatedAt: leads.updatedAt,
      propertyId: properties.id,
      propertyTitle: properties.title,
      propertyPrice: properties.price,
      propertyArea: properties.area,
      propertyRooms: properties.rooms,
      propertyAddress: properties.address,
      analysisScore: propertyAnalysis.investmentScore,
    })
    .from(leads)
    .leftJoin(properties, eq(leads.propertyId, properties.id))
    .leftJoin(propertyAnalysis, eq(propertyAnalysis.propertyId, properties.id))
    .where(eq(leads.contactId, id))
    .orderBy(desc(leads.updatedAt));

  const tags = (() => {
    try { return JSON.parse(contact.tags ?? "[]") as string[]; } catch { return []; }
  })();

  return (
    <div className="space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
        <ArrowLeft size={14} weight="bold" />
        Zpět na kontakty
      </Link>

      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-lg font-mono font-medium">
            {(contact.name ?? "??").split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{contact.name ?? "Neznámý"}</h1>
            <Badge variant={contact.type === "agent" ? "default" : "secondary"} size="sm" className="mt-1">
              {contact.type === "agent" ? "Makléř" : "Majitel"}
            </Badge>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {contact.phone && (
            <div className="flex items-center gap-2 text-muted">
              <Phone size={14} weight="bold" />
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="text-accent hover:underline">{contact.phone}</a>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-muted">
              <Envelope size={14} weight="bold" />
              <a href={`mailto:${contact.email}`} className="text-accent hover:underline">{contact.email}</a>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {tags.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/5 text-muted border border-border/30">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold tracking-tight mb-4">Inzeráty ({contactLeads.length})</h2>
        {contactLeads.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
            <p className="text-sm text-muted">Tento kontakt není přiřazen k žádné nemovitosti.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-4 text-xs text-muted font-medium">Nemovitost</th>
                    <th className="text-right p-4 text-xs text-muted font-medium">Cena</th>
                    <th className="text-right p-4 text-xs text-muted font-medium">Stav jednání</th>
                    <th className="text-right p-4 text-xs text-muted font-medium">Skóre</th>
                    <th className="text-right p-4 text-xs text-muted font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {contactLeads.map((l) => (
                    <tr key={l.leadId} className="hover:bg-card-hover transition-colors">
                      <td className="p-4">
                        <p className="font-medium truncate max-w-[250px]">{l.propertyTitle ?? "Neznámá nemovitost"}</p>
                        {l.propertyAddress && <p className="text-xs text-muted truncate max-w-[250px]">{l.propertyAddress}</p>}
                      </td>
                      <td className="p-4 text-right font-mono">{l.propertyPrice ? `${l.propertyPrice.toLocaleString()} Kč` : "—"}</td>
                      <td className="p-4 text-right">
                        <span className={`text-xs font-medium ${stageColors[l.stage] ?? "text-muted"}`}>
                          {stageLabels[l.stage] ?? l.stage}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono">{l.analysisScore ?? "—"}</td>
                      <td className="p-4 text-right">
                        {l.propertyId && (
                          <Link href={`/properties/${l.propertyId}`} className="text-xs text-accent hover:underline">
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
