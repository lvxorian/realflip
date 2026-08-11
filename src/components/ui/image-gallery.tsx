"use client";

import { useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface ImageGalleryProps {
  images: string[];
  alt: string;
  score?: number;
}

export function ImageGallery({ images, alt, score }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [errored, setErrored] = useState<Set<number>>(new Set());
  // Přirozený poměr stran aktuální fotky — kontejner se mu přizpůsobí,
  // takže fotka se zobrazí celá (bez ořezu) jako na originálním inzerátu.
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  const handleImgError = (i: number) => {
    setErrored((prev) => new Set(prev).add(i));
  };

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      // Rozumné meze: čtverec až panoráma — extrémní poměry se zkrotí,
      // běžné realitní fotky (4:3, 3:2, 16:9) se zobrazí bez ořezu.
      const ratio = img.naturalWidth / img.naturalHeight;
      setNaturalRatio(Math.min(2.1, Math.max(0.8, ratio)));
    }
  };

  if (!images || images.length === 0 || errored.size >= images.length) {
    return (
      <div className="relative aspect-[8/5] property-image-shimmer flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
        {score !== undefined && (
          <div className="relative flex flex-col items-center gap-2">
            <span className="text-3xl font-mono text-muted/40">{score}</span>
            <span className="text-[10px] text-muted/60 font-mono">bez fotek</span>
          </div>
        )}
      </div>
    );
  }

  const goPrev = () =>
    setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const goNext = () =>
    setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="relative">
      <div
        className="relative w-full bg-card overflow-hidden"
        style={naturalRatio ? { aspectRatio: `${naturalRatio}` } : { aspectRatio: "8 / 5" }}
      >
        {errored.has(activeIndex) ? (
          <div className="absolute inset-0 property-image-shimmer flex items-center justify-center">
            <span className="text-3xl font-mono text-muted/40">{score ?? ""}</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={activeIndex}
            src={images[activeIndex]}
            alt={`${alt} - foto ${activeIndex + 1}`}
            // object-cover: když kontejner kopíruje přirozený poměr fotky, nedojde
            // k žádnému ořezu ani pruhům; u extrémních poměrů (mimo clamp 0.8–2.1)
            // se jen lehce ořízne, ale nikdy nevzniknou pruhy.
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onLoad={handleImgLoad}
            onError={() => handleImgError(activeIndex)}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Predchozi fotka"
              className="absolute left-3 top-1/2 -translate-y-1/2 glass h-9 w-9 rounded-full flex items-center justify-center hover:bg-card-hover transition-colors z-10"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <button
              onClick={goNext}
              aria-label="Dalsi fotka"
              className="absolute right-3 top-1/2 -translate-y-1/2 glass h-9 w-9 rounded-full flex items-center justify-center hover:bg-card-hover transition-colors z-10"
            >
              <CaretRight size={16} weight="bold" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 glass px-2.5 py-1 rounded-full text-[11px] font-mono z-10">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto snap-x snap-mandatory">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`relative h-16 w-24 shrink-0 snap-start rounded-lg overflow-hidden border-2 transition-all ${
                i === activeIndex
                  ? "border-accent opacity-100"
                  : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${alt} thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={() => handleImgError(i)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
