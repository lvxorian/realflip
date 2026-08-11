"use client";

import { useState } from "react";
import { House, Prohibit } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PropertyImageProps {
  src?: string | null;
  alt: string;
  score?: number | null;
  className?: string;
  containerClassName?: string;
  removed?: boolean;
}

/**
 * Obrázek nemovitosti s jednotným fallbackem při chybě načtení.
 * Místo prázdného boxu (onError → display:none) zobrazí logo — domeček.
 * Přes `removed` zobrazí stav "INZERÁT ODSTRANĚN" (žádný obrázek se nenačítá).
 *
 * Fotka vyplní celý kontejner (object-cover) — kontejnery by měly mít poměr
 * stran 8:5 (aspect-[8/5]), který odpovídá většině fotografií portálů
 * (16:9 a 3:2), takže ořez je minimální a nevznikají žádné pruhy.
 */
export function PropertyImage({
  src,
  alt,
  className,
  containerClassName,
  removed = false,
}: PropertyImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed && !removed;

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", className)}
        />
      ) : removed ? (
        <div className="h-full w-full property-image-shimmer flex flex-col items-center justify-center gap-1.5 px-2 text-center">
          <Prohibit size={20} weight="fill" className="text-muted/40" />
          <span className="text-[10px] font-bold tracking-widest text-muted uppercase">
            Inzerát odstraněn
          </span>
        </div>
      ) : (
        <div className="h-full w-full property-image-shimmer flex items-center justify-center">
          <House size={32} weight="fill" className="text-accent" />
        </div>
      )}
    </div>
  );
}
