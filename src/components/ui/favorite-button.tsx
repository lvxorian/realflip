"use client";

import { useState, useCallback } from "react";
import { Star } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  propertyId: string;
  initialFavorited?: boolean;
  size?: number;
  className?: string;
}

export function FavoriteButton({
  propertyId,
  initialFavorited = false,
  size = 16,
  className,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    const prev = favorited;
    setFavorited(!prev);
    setLoading(true);

    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });

      if (!res.ok) {
        setFavorited(prev);
      }
    } catch {
      setFavorited(prev);
    } finally {
      setLoading(false);
    }
  }, [propertyId, favorited, loading]);

  return (
    <button
      onClick={toggle}
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-all duration-200",
        "hover:scale-110 active:scale-95",
        favorited
          ? "text-accent drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]"
          : "text-muted hover:text-foreground",
        loading && "opacity-50 pointer-events-none",
        className
      )}
      aria-label={favorited ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
    >
      <Star
        size={size}
        weight={favorited ? "fill" : "regular"}
        className="transition-all duration-200"
      />
    </button>
  );
}
