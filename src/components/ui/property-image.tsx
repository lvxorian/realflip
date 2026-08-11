"use client";

import { useState } from "react";
import { House, Prohibit } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PropertyImageProps {
  src?: string | null;
  alt: string;
  score?: number | null;
  /** Nepoužívejte sem object-* třídy — režim vyplnění řídí prop `fit`. */
  className?: string;
  containerClassName?: string;
  removed?: boolean;
  /**
   * "contain" (výchozí): celá fotka viditelná na rozmazaném pozadí.
   * "cover": fotka vyplní kontejner s ořezem — vhodné jen pro malé miniatury.
   */
  fit?: "contain" | "cover";
}

/**
 * Obrázek nemovitosti s jednotným fallbackem při chybě načtení.
 * Místo prázdného boxu (onError → display:none) zobrazí logo — domeček.
 * Přes `removed` zobrazí stav "INZERÁT ODSTRANĚN" (žádný obrázek se nenačítá).
 */
export function PropertyImage({
  src,
  alt,
  className,
  containerClassName,
  removed = false,
  fit = "contain",
}: PropertyImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed && !removed;

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {showImage ? (
        fit === "cover" ? (
          // Malé miniatury: fotka vyplní plochu, bez rozmazaného pozadí
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
        ) : (
          <>
            {/* Rozmazané pozadí — vyplní celý kontejner bez ořezu (skryté před čtečkami) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-lg"
            />
            {/* Celá fotka — vždy viditelná bez ořezání, jako v originálním inzerátu */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className={cn("relative h-full w-full object-contain", className)}
            />
          </>
        )
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
