"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ScoreGauge } from "./score-gauge";
import { PriceTag } from "./price-tag";
import { Badge } from "./badge";
import { FavoriteButton } from "./favorite-button";
import { PropertyImage } from "./property-image";
import { csDays } from "@/lib/utils";
import { MapPin, Images, CaretLeft, CaretRight } from "@phosphor-icons/react";

interface PropertyCardProps {
  id: string;
  title: string;
  price: number;
  pricePerSqm?: number;
  address: string;
  score: number;
  isFavorited?: boolean;
  status?: string;
  area?: string;
  rooms?: string;
  days?: number;
  index?: number;
  imageUrl?: string;
  imageUrls?: string[];
  photoCount?: number;
  undervaluationPct?: number;
  isAuction?: boolean;
  removed?: boolean;
  priceRating?: string;
  earlyOffer?: boolean;
}

const RATING_VARIANT: Record<string, "success" | "default" | "warning" | "danger"> = {
  "Velmi dobrá cena": "success",
  "Dobrá cena": "default",
  "Férová cena": "default",
  "Vyšší cena": "warning",
  "Vysoká cena": "danger",
};

export function PropertyCard({
  id,
  title,
  price,
  pricePerSqm,
  address,
  score,
  isFavorited = false,
  status,
  area,
  rooms,
  days,
  index = 0,
  imageUrl,
  imageUrls,
  photoCount = 0,
  undervaluationPct,
  isAuction = false,
  removed = false,
  priceRating,
  earlyOffer = false,
}: PropertyCardProps) {
  const statusVariant =
    status === "Nový" ? "success" :
    status === "Cenový drop" ? "warning" :
    status === "Sledovaný" ? "default" :
    "secondary";

  const isUndervalued = undervaluationPct !== undefined && undervaluationPct > 0;

  // Seznam fotek pro mini-carousel na kartě (bez prokliku do detailu).
  const photos: string[] =
    imageUrls && imageUrls.length > 0
      ? imageUrls.filter((u): u is string => Boolean(u))
      : imageUrl
      ? [imageUrl]
      : [];
  const hasCarousel = photos.length > 1;
  const [photoIdx, setPhotoIdx] = useState(0);
  const safeIdx = Math.min(photoIdx, Math.max(0, photos.length - 1));
  const currentSrc = photos[safeIdx];
  const photoTotal = photos.length > 0 ? photos.length : photoCount;

  const cyclePhoto = (e: React.MouseEvent, dir: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();
    if (photos.length < 2) return;
    setPhotoIdx((i) => (i + dir + photos.length) % photos.length);
  };

  return (
    <Link href={`/properties/${id}`}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, type: "spring" as const, stiffness: 100, damping: 20 }}
        className="group rounded-2xl border border-border/50 bg-card overflow-hidden hover:bg-card-hover hover:border-accent/20 transition-all duration-300 cursor-pointer h-full flex flex-col"
      >
        {/* Image — poměr 8:5 odpovídá většině fotek portálů (16:9 a 3:2) */}
        <div className="relative aspect-[8/5] overflow-hidden">
          <PropertyImage
            key={currentSrc ?? "no-photo"}
            src={currentSrc}
            alt={title}
            score={score}
            removed={removed}
            containerClassName="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <FavoriteButton propertyId={id} initialFavorited={isFavorited} size={14} className="h-9 w-9 bg-card/50 backdrop-blur-sm rounded-full" />
            <ScoreGauge score={score} size={36} strokeWidth={2.5} />
          </div>
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {isAuction && (
              <Badge variant="danger" size="sm">Dražba</Badge>
            )}
            {status && (
              <Badge variant={statusVariant} size="sm">{status}</Badge>
            )}
            {isUndervalued && (
              <Badge variant="success" size="sm">Podhodnoceno {Math.round(undervaluationPct!)}%</Badge>
            )}
            {priceRating && (
              <Badge variant={RATING_VARIANT[priceRating] ?? "default"} size="sm">{priceRating}</Badge>
            )}
            {earlyOffer && (
              <Badge variant="default" size="sm">Předstih</Badge>
            )}
          </div>
          {hasCarousel && !removed && (
            <>
              <button
                type="button"
                onClick={(e) => cyclePhoto(e, -1)}
                aria-label="Předchozí foto"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <button
                type="button"
                onClick={(e) => cyclePhoto(e, 1)}
                aria-label="Další foto"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CaretRight size={14} weight="bold" />
              </button>
            </>
          )}
          {photoTotal > 0 && !removed && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/55 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-white">
              <Images size={11} weight="fill" />
              {hasCarousel ? `${safeIdx + 1}/${photos.length}` : photoTotal}
            </div>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col">
          {/* Nadpis: pevná výška 2 řádků, ať se spodní řádky (adresa, dispozice) nepohybují */}
          <h3
            className="font-semibold tracking-tight text-sm leading-5 min-h-10 mb-1 group-hover:text-accent transition-colors line-clamp-2"
            title={title}
          >
            {title}
          </h3>
          <div className="flex items-center gap-1 text-[10px] text-muted mb-3 line-clamp-1" title={address}>
            <MapPin size={10} weight="bold" className="shrink-0" />
            <span className="truncate">{address}</span>
          </div>

          {/* Dispozice + plocha jako výrazné chipy (vždy na stejné pozici) */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 min-w-0">
              {rooms && (
                <span className="inline-flex items-center rounded-md border border-border/60 bg-card-hover px-1.5 py-0.5 text-[11px] font-semibold text-foreground/90">
                  {rooms}
                </span>
              )}
              {area && (
                <span className="inline-flex items-center rounded-md border border-border/60 bg-card-hover px-1.5 py-0.5 text-[11px] font-semibold text-foreground/90">
                  {area}
                </span>
              )}
            </div>
            {days !== undefined && <span className="shrink-0 text-[10px] text-muted">{csDays(days)}</span>}
          </div>

          <div className="mt-auto">
            <PriceTag price={price} perSqm={pricePerSqm} size="sm" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
