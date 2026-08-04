"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const SCHEDULE_OPTIONS = [
  { value: "manual", label: "Ručně" },
  { value: "daily", label: "Denně" },
  { value: "weekly", label: "Týdně" },
];

export const SCHEDULE_LABELS: Record<string, string> = Object.fromEntries(
  SCHEDULE_OPTIONS.map((o) => [o.value, o.label])
);

export const PROPERTY_TYPES = [
  { value: "flat", label: "Byt" },
  { value: "house", label: "Dům" },
  { value: "land", label: "Pozemek" },
  { value: "commercial", label: "Komerční" },
  { value: "garage", label: "Garáž" },
];

export interface SearchFormValues {
  name: string;
  filters: Record<string, unknown>;
  schedule: string;
}

interface SearchFormProps {
  initial?: SearchFormValues;
  submitLabel?: string;
  onSubmit: (values: SearchFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function SearchForm({ initial, submitLabel = "Uložit hledání", onSubmit, onCancel }: SearchFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(String(initial?.filters.location ?? ""));
  const [district, setDistrict] = useState(String(initial?.filters.district ?? ""));
  const [priceMin, setPriceMin] = useState(String(initial?.filters.priceMin ?? ""));
  const [priceMax, setPriceMax] = useState(String(initial?.filters.priceMax ?? ""));
  const [areaMin, setAreaMin] = useState(String(initial?.filters.areaMin ?? ""));
  const [areaMax, setAreaMax] = useState(String(initial?.filters.areaMax ?? ""));
  const [propertyType, setPropertyType] = useState(String(initial?.filters.propertyType ?? ""));
  const [schedule, setSchedule] = useState(initial?.schedule ?? "manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const buildFilters = (): Record<string, unknown> => {
    const filters: Record<string, unknown> = {};
    if (location.trim()) filters.location = location.trim();
    if (district.trim()) filters.district = district.trim();
    if (priceMin) filters.priceMin = parseInt(priceMin);
    if (priceMax) filters.priceMax = parseInt(priceMax);
    if (areaMin) filters.areaMin = parseInt(areaMin);
    if (areaMax) filters.areaMax = parseInt(areaMax);
    if (propertyType) filters.propertyType = propertyType;
    return filters;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Zadejte název hledání"); return; }
    if (!location.trim()) { setError("Zadejte lokalitu"); return; }

    setSaving(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), filters: buildFilters(), schedule });
    } catch {
      setError("Chyba při ukládání hledání");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Základní informace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Název hledání"
            placeholder="např. Byty Praha 2 do 5M"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lokalita</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Město / Obec"
            placeholder="např. Praha, Brno, Ostrava"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            label="Městská část (volitelné)"
            placeholder="např. Vinohrady, Smíchov"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cena od (Kč)"
              type="number"
              placeholder="např. 2000000"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
            <Input
              label="Cena do (Kč)"
              type="number"
              placeholder="např. 8000000"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Plocha od (m²)"
              type="number"
              placeholder="např. 40"
              value={areaMin}
              onChange={(e) => setAreaMin(e.target.value)}
            />
            <Input
              label="Plocha do (m²)"
              type="number"
              placeholder="např. 120"
              value={areaMax}
              onChange={(e) => setAreaMax(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typ nemovitosti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPropertyType("")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !propertyType
                  ? "bg-accent text-white"
                  : "bg-card text-foreground border border-border hover:bg-card-hover"
              }`}
            >
              Vše
            </button>
            {PROPERTY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setPropertyType(t.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  propertyType === t.value
                    ? "bg-accent text-white"
                    : "bg-card text-foreground border border-border hover:bg-card-hover"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plánování</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SCHEDULE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSchedule(o.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  schedule === o.value
                    ? "bg-accent text-white"
                    : "bg-card text-foreground border border-border hover:bg-card-hover"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-danger text-sm">{error}</div>
      )}

      <div className="flex gap-3">
        <Button type="submit" loading={saving} size="lg">
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onCancel}
        >
          Zrušit
        </Button>
      </div>
    </form>
  );
}