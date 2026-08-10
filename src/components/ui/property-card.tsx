"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ScoreGauge } from "./score-gauge";
import { PriceTag } from "./price-tag";
import { Badge } from "./badge";
import { FavoriteButton } from "./favorite-button";
import { PropertyImage } from "./property-image";
import { MapPin, Images } from "@phosphor-icons/react";

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
            src={imageUrl}
            alt={title}
            score={score}
            removed={removed}
            containerClassName="h-full w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-3 right-3 flex flex-col items-center gap-1">
            <ScoreGauge score={score} size={36} strokeWidth={2.5} />
            <FavoriteButton propertyId={id} initialFavorited={isFavorited} size={14} className="h-6 w-6 bg-card/50 backdrop-blur-sm rounded-full" />
          </div>
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {isAuction && (
              <Badge variant="danger" size="sm">Dražba</Badge>
            )}
            {status && (
              <Badge variant={statusVariant} size="sm">{status}</Badge>
            )}
            {portalCount && portalCount > 0 && (
              <Badge variant="outline" size="sm">{portalCount} portály</Badge>
            )}
            {isUndervalued && (
              <Badge variant="success" size="sm">Podhodnoceno {Math.round(undervaluationPct!)}%</Badge>
            )}
          </div>
          {photoCount > 0 && !removed && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/55 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-white">
              <Images size={11} weight="fill" />
              {photoCount}
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
