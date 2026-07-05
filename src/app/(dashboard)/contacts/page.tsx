"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Search,
  Phone,
  Mail,
  User,
  Tag,
  Plus,
  MoreHorizontal,
} from "lucide-react";

const contacts = [
  { id: "1", name: "Jan Novák", phone: "+420 777 123 456", email: "jan.novak@reality.cz", type: "agent", tags: ["RE/MAX", "Praha"], deals: 3, lastContact: "před 2 dny" },
  { id: "2", name: "Marie Dvořáková", phone: "+420 731 456 789", email: "marie.dvorakova@century21.cz", type: "agent", tags: ["Century21", "Brno"], deals: 1, lastContact: "před 5 dny" },
  { id: "3", name: "Petr Svoboda", phone: "+420 602 987 654", email: "petr.svoboda@email.cz", type: "owner", tags: ["majitel", "Ostrava", "motivovaný"], deals: 1, lastContact: "před 1 dnem" },
  { id: "4", name: "Tomáš Černý", phone: "+420 605 111 222", email: "cerny.tomas@seznam.cz", type: "owner", tags: ["majitel", "Praha"], deals: 0, lastContact: "včera" },
  { id: "5", name: "Eva Novotná", phone: "+420 733 555 666", email: "eva.novotna@remax.cz", type: "agent", tags: ["RE/MAX", "Liberec"], deals: 2, lastContact: "před týdnem" },
];

export default function ContactsPage() {
  const [search, setSearch] = useState("");

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kontakty</h1>
          <p className="text-muted text-sm mt-1">{contacts.length} kontaktů</p>
        </div>
        <Button variant="glass" size="sm">
          <Plus size={14} />
          Přidat kontakt
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Hledat kontakty..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((contact, idx) => (
          <motion.div
            key={contact.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
          >
            <Card glass className="hover:border-accent/30 transition-all duration-200 group">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 border border-accent/30 text-sm font-medium text-accent">
                  {contact.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    <Badge
                      variant={contact.type === "agent" ? "info" : "secondary"}
                      size="sm"
                    >
                      {contact.type === "agent" ? "Makléř" : "Majitel"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Phone size={12} />
                      {contact.phone}
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Mail size={12} />
                        {contact.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="outline" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="text-right text-xs text-muted">
                  <p>{contact.deals} dealů</p>
                  <p>{contact.lastContact}</p>
                </div>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal size={14} />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
