"use client";

import { useEffect, useState } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";

interface ImageGalleryProps {
  images: string[];
  alt: string;
  score?: number;
}

export function ImageGallery({ images, alt, score }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [errored, setErrored] = useState<Set<number>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  // Poměr stran (width/height) načtené fotky per index — podle něj se vybere,
  // jestli fotka vyplní celý box (na šířku, object-cover) nebo zůstanou blur
  // pruhy po stranách (na výšku, object-contain — aby se neořezala budova).
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({});

  // Šipky ← → na klávesnici listují mezi fotkami (používá se na detailu
  // nemovitosti). Při psaní do polí (editace rozměrů, kalkulačka…) se nezasahuje.
  useEffect(() => {
    if (!images || images.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((i) => (i === 0 ? images.length - 1 : i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((i) => (i === images.length - 1 ? 0 : i + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images]);

  // Esc zavře fullscreen a zamkne scroll stránky, dokud je fullscreen otevřený.
  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  const handleImgError = (i: number) => {
    setErrored((prev) => new Set(prev).add(i));
  };

  const handleImgLoad = (i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setAspectRatios((prev) => ({
        ...prev,
        [i]: img.naturalWidth / img.naturalHeight,
      }));
    }
  };

  // Fotka na šířku (poměr ≥ 1) → vyplní celý box bez pruhů (object-cover).
  // Fotka na výšku (poměr < 1) → object-contain, kolem zůstanou blur pruhy.
  const ratio = aspectRatios[activeIndex];
  const isPortrait = ratio !== undefined && ratio < 1;

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
      {/* Pevný poměr 8:5 — velikost boxu se nikdy nemění podle fotky,
          takže se layout stránky nedeformuje. Fotky na šířku vyplní celý box
          (object-cover), fotky na výšku zůstanou celé (object-contain) a prostor
          kolem vyplňuje rozmazaná kopie téže fotky (blur pruhy). */}
      <div className="relative w-full bg-card overflow-hidden aspect-[8/5]">
        {errored.has(activeIndex) ? (
          <div className="absolute inset-0 property-image-shimmer flex items-center justify-center">
            <span className="text-3xl font-mono text-muted/40">{score ?? ""}</span>
          </div>
        ) : (
          <>
            {/* Rozmazaná kopie fotky vyplňuje prostor kolem (blur pruhy jako na
                profi portálech) — fotka se nikdy neprotáhne a layout se nemění. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`bg-${activeIndex}`}
              src={images[activeIndex]}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              onError={() => handleImgError(activeIndex)}
            />
            {/* Fotka: na šířku vyplní celý box (object-cover), na výšku zůstane
                celá s blur pruhy po stranách. Klik doprostřed otevře fullscreen
                (boční zóny patří šipkám ← →). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={activeIndex}
              src={images[activeIndex]}
              alt={`${alt} - foto ${activeIndex + 1}`}
              className={`absolute inset-0 h-full w-full ${isPortrait ? "object-contain" : "object-cover"} cursor-zoom-in`}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              onClick={() => setFullscreen(true)}
              onLoad={handleImgLoad(activeIndex)}
              onError={() => handleImgError(activeIndex)}
            />
          </>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {images.length > 1 && (
          <>
            {/* Klikaci zona pres CELOU vysku boku fotky: i kdyz se kontejner
                zvetsi/zmensi (fotky maji ruzne pomery stran), okraj je vzdy
                klikatelny odshora dolu — mys na okraji nikdy nespadne vedle. */}
            <button
              onClick={goPrev}
              aria-label="Predchozi fotka"
              className="group absolute inset-y-0 left-0 w-1/3 sm:w-1/4 z-10 flex items-center justify-start cursor-pointer"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/35 to-transparent transition-all group-hover:from-black/55" />
              <span className="pointer-events-none ml-3 flex h-9 w-9 items-center justify-center rounded-full glass opacity-90 transition-all group-hover:scale-110 group-hover:bg-card-hover">
                <CaretLeft size={16} weight="bold" />
              </span>
            </button>
            <button
              onClick={goNext}
              aria-label="Dalsi fotka"
              className="group absolute inset-y-0 right-0 w-1/3 sm:w-1/4 z-10 flex items-center justify-end cursor-pointer"
            >
              <span className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/35 to-transparent transition-all group-hover:from-black/55" />
              <span className="pointer-events-none mr-3 flex h-9 w-9 items-center justify-center rounded-full glass opacity-90 transition-all group-hover:scale-110 group-hover:bg-card-hover">
                <CaretRight size={16} weight="bold" />
              </span>
            </button>

            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 glass px-2.5 py-1 rounded-full text-[11px] font-mono z-10">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Fullscreen overlay: fotka, šipky ← →, křížek nahoře vpravo, Esc zavře */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 sm:p-10"
          onClick={() => setFullscreen(false)}
        >
          <button
            onClick={() => setFullscreen(false)}
            aria-label="Zavřít fullscreen"
            title="Zavřít (Esc)"
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors cursor-pointer"
          >
            <X size={20} weight="bold" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Predchozi fotka fullscreen"
                className="absolute left-3 sm:left-8 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors cursor-pointer z-10"
              >
                <CaretLeft size={24} weight="bold" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Dalsi fotka fullscreen"
                className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors cursor-pointer z-10"
              >
                <CaretRight size={24} weight="bold" />
              </button>
            </>
          )}

          {errored.has(activeIndex) ? (
            <div className="flex flex-col items-center gap-2 text-white/60">
              <span className="text-3xl font-mono">{score ?? ""}</span>
              <span className="text-xs font-mono">fotka není k dispozici</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={activeIndex}
              src={images[activeIndex]}
              alt={`${alt} - fullscreen ${activeIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              onClick={(e) => e.stopPropagation()}
              onError={() => handleImgError(activeIndex)}
            />
          )}

          {images.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white z-10">
              {activeIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}

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
