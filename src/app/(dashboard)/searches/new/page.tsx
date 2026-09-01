"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchForm } from "@/components/searches/search-form";

export default function NewSearchPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  const handleSubmit = async (values: { name: string; filters: Record<string, unknown>; schedule: string }) => {
    const res = await fetch("/api/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Chyba při vytváření hledání");
    }

    const data = await res.json();
    router.push(`/searches/${data.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nové hledání</h1>
      <SearchForm
        submitLabel="Vytvořit hledání"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}