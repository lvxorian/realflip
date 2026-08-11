"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ScoreGauge } from "./score-gauge";
import { PriceTag } from "./price-tag";
import { Badge } from "./badge";
import { FavoriteButton } from "./favorite-button";
import { PropertyImage } from "./property-image";
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
  portalCount?: number;
  removed?: boolean;
}

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
  portalCount,
  removed = false,
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
        {/* Image */}
        <div className="relative h-40 overflow-hidden">
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
            <FavoriteButton propertyId={id} initialFavorited={isFavorited} size={14} className="h-6 w-6 bg-card/50 backdrop-blur-sm rounded-full" />
            <ScoreGauge score={score} size={36} strokeWidth={2.5} />
          </div>
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {isAuction && (
              <Badge variant="danger" size="sm">Dražba</Badge>
            )}
            {status && (
              <Badge variant={statusVariant} size="sm">{status}</Badge>
            )}
            {portalCount != null && portalCount > 0 && (
              <Badge variant="outline" size="sm">{portalCount} portály</Badge>
            )}
            {isUndervalued && (
              <Badge variant="success" size="sm">Podhodnoceno {Math.round(undervaluationPct!)}%</Badge>
            )}
          </div>
          {hasCarousel && !removed && (
            <>
              <button
                type="button"
                onClick={(e) => cyclePhoto(e, -1)}
                aria-label="Předchozí foto"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CaretLeft size={14} weight="bold" />
              </button>
              <button
                type="button"
                onClick={(e) => cyclePhoto(e, 1)}
                aria-label="Další foto"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/70 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          <h3 className="font-semibold tracking-tight text-sm mb-1 group-hover:text-accent transition-colors line-clamp-2" title={title}>
            {title}
          </h3>
          <div className="flex items-center gap-1 text-[10px] text-muted mb-3 line-clamp-1" title={address}>
            <MapPin size={10} weight="bold" className="shrink-0" />
            <span className="truncate">{address}</span>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-x-1.5 text-xs font-semibold text-foreground/90">
              {area && <span>{area}</span>}
              {rooms && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-border" />
                  <span>{rooms}</span>
                </>
              )}
            </div>
            {days !== undefined && <span className="text-[10px] text-muted">{days} dní</span>}
          </div>

          <div className="mt-auto">
            <PriceTag price={price} perSqm={pricePerSqm} size="sm" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
