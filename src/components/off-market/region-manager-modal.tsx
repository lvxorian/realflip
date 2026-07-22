"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash } from "@phosphor-icons/react";

interface RegionManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function RegionManagerModal({ open, onClose }: RegionManagerModalProps) {
  const [regions, setRegions] = useState<string[]>([]);
  const [newRegion, setNewRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const loadRegions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/off-market/regions");
      if (res.ok) setRegions(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadRegions();
  }, [open]);

  const handleAdd = async () => {
    const slug = newRegion.trim().toLowerCase();
    if (!slug || slug.length < 2) { setError("Zadejte platný název regionu"); return; }
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/off-market/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: slug }),
      });
      if (res.ok) {
        setRegions((prev) => [...prev, slug].sort());
        setNewRegion("");
      } else {
        const data = await res.json();
        setError(data.error || "Chyba při přidávání");
      }
    } catch { setError("Chyba při přidávání"); }
    setAdding(false);
  };

  const handleDelete = async (region: string) => {
    try {
      const res = await fetch(`/api/off-market/regions?region=${encodeURIComponent(region)}`, { method: "DELETE" });
      if (res.ok) setRegions((prev) => prev.filter((r) => r !== region));
    } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl border border-border/50 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border/30">
              <h2 className="font-semibold tracking-tight">Spravovat lokality</h2>
              <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-card-hover flex items-center justify-center transition-colors">
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="např. praha, brno, ostrava"
                  className="flex-1 h-9 rounded-lg border border-border/50 bg-card px-3 text-xs text-foreground focus:outline-none focus:border-accent/50"
                />
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="h-9 w-9 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Plus size={16} weight="bold" />
                </button>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="space-y-1 max-h-60 overflow-y-auto">
                {loading ? (
                  <p className="text-xs text-muted text-center py-4">Načítám...</p>
                ) : regions.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">Žádné lokality. Přidejte první.</p>
                ) : (
                  regions.map((r) => (
                    <div key={r} className="flex items-center justify-between rounded-lg bg-card-hover px-3 py-2">
                      <span className="text-sm capitalize">{r}</span>
                      <button
                        onClick={() => handleDelete(r)}
                        className="h-7 w-7 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end p-5 border-t border-border/30">
              <button
                onClick={onClose}
                className="rounded-xl border border-border/50 bg-card px-5 py-2 text-sm font-medium text-foreground/80 hover:bg-card-hover transition-colors"
              >
                Zavřít
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
