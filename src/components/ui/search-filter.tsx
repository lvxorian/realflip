"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type SearchOption = { id: string; name: string };

export function SearchFilter({
  searches,
  activeSearchName,
  itemsCount,
}: {
  searches: SearchOption[];
  activeSearchName: string;
  itemsCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = searchParams.get("searchId") ?? "";

  return (
    <form
      method="GET"
      className="flex items-center gap-3"
    >
      <select
        name="searchId"
        onChange={(e) => {
          const val = e.target.value;
          const params = new URLSearchParams();
          if (val) params.set("searchId", val);
          const qs = params.toString();
          router.push(qs ? `/properties?${qs}` : "/properties");
        }}
        className="h-10 rounded-lg border border-border/50 bg-card px-3 text-sm text-foreground focus:outline-none focus:border-accent/50 cursor-pointer"
        value={searchId}
      >
        <option value="">Všechny inzeráty</option>
        {searches.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {searchId && (
        <Link
          href="/properties"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          × Zrušit filtr
        </Link>
      )}
      <span className="text-xs text-muted ml-auto">
        {activeSearchName ? `Filtrováno: ${activeSearchName}` : `${itemsCount} inzerátů`}
      </span>
    </form>
  );
}
