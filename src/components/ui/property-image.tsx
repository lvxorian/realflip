"use client";

import { useState } from "react";
import { Buildings } from "@phosphor-icons/react";
import { ScoreGauge } from "./score-gauge";
import { cn } from "@/lib/utils";

interface PropertyImageProps {
  src?: string | null;
  alt: string;
  score?: number | null;
  className?: string;
  containerClassName?: string;
  showScore?: boolean;
}

/**
 * Obrázek nemovitosti s jednotným fallbackem při chybě načtení.
 * Místo prázdného boxu (onError → display:none) zobrazí ikonu budovy.
 */
export function PropertyImage({
  src,
  alt,
  score,
  className,
  containerClassName,
  showScore = true,
}: PropertyImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;

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
