"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchForm } from "@/components/searches/search-form";
import type { SearchFormValues } from "@/components/searches/search-form";

export default function EditSearchPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [initial, setInitial] = useState<SearchFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;

    fetch(`/api/searches/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((d: { name: string; filters: Record<string, unknown>; schedule: string }) => {
        if (!cancelled) setInitial({ name: d.name, filters: d.filters, schedule: d.schedule });
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, router, params.id]);

  const handleSubmit = async (values: SearchFormValues) => {
    const res = await fetch(`/api/searches/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Chyba při úpravě hledání");
    }

    router.push(`/searches/${params.id}`);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (notFound || !initial) {
    router.push("/searches");
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upravit hledání</h1>
      <SearchForm
        initial={initial}
        submitLabel="Uložit změny"
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/searches/${params.id}`)}
      />
    </div>
  );
}