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

  if (!images || images.length === 0) {
    return (
      <div className="relative h-64 property-image-shimmer flex items-center justify-center">
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
      <div className="relative h-80 bg-card overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[activeIndex]}
          alt={`${alt} - foto ${activeIndex + 1}`}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Predchozi fotka"
              className="absolute left-3 top-1/2 -translate-y-1/2 glass h-9 w-9 rounded-full flex items-center justify-center hover:bg-card-hover transition-colors"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <button
              onClick={goNext}
              aria-label="Dalsi fotka"
              className="absolute right-3 top-1/2 -translate-y-1/2 glass h-9 w-9 rounded-full flex items-center justify-center hover:bg-card-hover transition-colors"
            >
              <CaretRight size={16} weight="bold" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 glass px-2.5 py-1 rounded-full text-[11px] font-mono">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`relative h-16 w-24 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
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
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
