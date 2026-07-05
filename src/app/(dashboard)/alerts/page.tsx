"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Bell,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MapPin,
  DollarSign,
  Target,
} from "lucide-react";

interface Alert {
  id: string;
  name: string;
  conditions: string;
  active: boolean;
  lastTriggered: string | null;
}

const initialAlerts: Alert[] = [
  { id: "1", name: "Praha – pod 5M", conditions: "Lokalita = Praha AND cena < 5 000 000", active: true, lastTriggered: "před 2 dny" },
  { id: "2", name: "Vysoké skóre", conditions: "Investment skóre > 80", active: true, lastTriggered: "před 5 h" },
  { id: "3", name: "Price drop > 10%", conditions: "Snížení ceny > 10%", active: true, lastTriggered: "před 1 dnem" },
  { id: "4", name: "Brno – byty", conditions: "Lokalita = Brno AND typ = byt", active: false, lastTriggered: null },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(initialAlerts);

  function toggleAlert(id: string) {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  }

  function deleteAlert(id: string) {
    setAlerts(alerts.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerty</h1>
          <p className="text-muted text-sm mt-1">{alerts.filter((a) => a.active).length} aktivních</p>
        </div>
        <Button variant="glass" size="sm">
          <Plus size={14} />
          Nový alert
        </Button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, idx) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card
              glass
              className={`transition-all duration-200 ${
                alert.active ? "border-accent/20" : "opacity-50"
              }`}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Bell size={18} className={alert.active ? "text-accent" : "text-muted"} />
                  <div>
                    <p className="font-medium">{alert.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {alert.conditions}
                      {alert.lastTriggered && (
                        <> · Naposledy: {alert.lastTriggered}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={alert.active ? "text-accent" : "text-muted"}
                  >
                    {alert.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="text-muted hover:text-danger transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick create */}
      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Rychlé vytvoření alertu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: MapPin, label: "Lokalita", desc: "Alert na konkrétní lokalitu" },
              { icon: DollarSign, label: "Cena", desc: "Alert na cenové rozpětí" },
              { icon: Target, label: "Skóre", desc: "Alert na min. investment skóre" },
            ].map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                className="flex-col gap-1 h-20"
              >
                <preset.icon size={16} className="text-accent" />
                <span className="text-xs font-medium">{preset.label}</span>
                <span className="text-[10px] text-muted">{preset.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
