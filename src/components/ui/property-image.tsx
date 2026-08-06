"use client";

import { useState } from "react";
import { Buildings, Prohibit } from "@phosphor-icons/react";
import { ScoreGauge } from "./score-gauge";
import { cn } from "@/lib/utils";

interface PropertyImageProps {
  src?: string | null;
  alt: string;
  score?: number | null;
  className?: string;
  containerClassName?: string;
  showScore?: boolean;
  removed?: boolean;
}

/**
 * Obrázek nemovitosti s jednotným fallbackem při chybě načtení.
 * Místo prázdného boxu (onError → display:none) zobrazí ikonu budovy.
 * Přes `removed` zobrazí stav "INZERÁT ODSTRANĚN" (žádný obrázek se nenačítá).
 */
export function PropertyImage({
  src,
  alt,
  score,
  className,
  containerClassName,
  showScore = true,
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
          {showScore && score != null ? (
            <ScoreGauge score={score} size={32} strokeWidth={2.5} />
          ) : (
            <Buildings size={20} weight="duotone" className="text-muted/30" />
          )}
        </div>
      )}
    </div>
  );
}
