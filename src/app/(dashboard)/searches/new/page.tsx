"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROPERTY_TYPES = [
  { value: "flat", label: "Byt" },
  { value: "house", label: "Dům" },
  { value: "land", label: "Pozemek" },
  { value: "commercial", label: "Komerční" },
  { value: "garage", label: "Garáž" },
];

const SCHEDULE_OPTIONS = [
  { value: "manual", label: "Ručně" },
  { value: "daily", label: "Denně" },
  { value: "weekly", label: "Týdně" },
];

export default function NewSearchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [schedule, setSchedule] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Zadejte název hledání"); return; }
    if (!location.trim()) { setError("Zadejte lokalitu"); return; }

    setSaving(true);
    setError("");

    const filters: Record<string, unknown> = {};
    if (location.trim()) filters.location = location.trim();
    if (district.trim()) filters.district = district.trim();
    if (priceMin) filters.priceMin = parseInt(priceMin);
    if (priceMax) filters.priceMax = parseInt(priceMax);
    if (areaMin) filters.areaMin = parseInt(areaMin);
    if (areaMax) filters.areaMax = parseInt(areaMax);
    if (propertyType) filters.propertyType = propertyType;

    const res = await fetch("/api/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), filters, schedule }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Chyba při vytváření hledání");
      setSaving(false);
      return;
    }

    const data = await res.json();
    router.push(`/searches/${data.id}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nové hledání</h1>

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
            Vytvořit hledání
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
          >
            Zrušit
          </Button>
        </div>
      </form>
    </div>
  );
}
