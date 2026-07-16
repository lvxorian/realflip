"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MagnifyingGlass, Plus, Phone, Envelope } from "@phosphor-icons/react";
import { safeJsonParse } from "@/lib/utils";

interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  type: string | null;
  tags: string;
  notes: string | null;
}

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((d: Contact[]) => { setContacts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (status !== "authenticated" || loading) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kontakty</h1>
          <p className="text-sm text-muted mt-1">Načítání...</p>
        </div>
      </div>
    );
  }

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return !q ||
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kontakty</h1>
          <p className="text-sm text-muted mt-1">{contacts.length} kontaktů</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Hledat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 w-56"
            />
          </div>
          <Button size="sm" variant="default" className="gap-1.5">
            <Plus size={14} weight="bold" />
            Přidat
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
          <p className="text-sm text-muted">
            {contacts.length === 0 ? "Zatím žádné kontakty." : "Žádné kontakty neodpovídají hledání."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c, i) => {
            const tags = safeJsonParse<string[]>(c.tags, []);
            const initials = (c.name ?? "??").split(" ").map((n) => n[0]).join("").slice(0, 2);

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl border border-border/50 bg-card p-5 hover:bg-card-hover hover:border-accent/20 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-mono font-medium">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm">{c.name ?? "Neznámý"}</h3>
                    <Badge
                      variant={c.type === "agent" ? "default" : "secondary"}
                      size="sm"
                      className="mt-1"
                    >
                      {c.type === "agent" ? "Makléř" : c.type === "owner" ? "Majitel" : "Jiný"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {c.phone && (
                    <div className="flex items-center gap-2 text-muted">
                      <Phone size={12} weight="bold" />
                      {c.phone}
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 text-muted truncate">
                      <Envelope size={12} weight="bold" />
                      {c.email}
                    </div>
                  )}
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {tags.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/5 text-muted border border-border/30">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
