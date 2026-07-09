"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ScoreGauge } from "./score-gauge";
import { PriceTag } from "./price-tag";
import { Badge } from "./badge";
import { MapPin } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PropertyCardProps {
  id: string;
  title: string;
  price: number;
  pricePerSqm?: number;
  address: string;
  score: number;
  status?: string;
  area?: string;
  rooms?: string;
  days?: number;
  index?: number;
  imageUrl?: string;
}

export function PropertyCard({
  id,
  title,
  price,
  pricePerSqm,
  address,
  score,
  status,
  area,
  rooms,
  days,
  index = 0,
  imageUrl,
}: PropertyCardProps) {
  const statusVariant =
    status === "Nový" ? "success" :
    status === "Cenový drop" ? "warning" :
    status === "Sledovaný" ? "default" :
    "secondary";

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
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full property-image-shimmer flex items-center justify-center">
              <div className="flex items-center gap-1.5 text-accent/30 text-sm font-mono">
                <span className="text-2xl">{score}</span>
                <span className="text-[10px]">skóre</span>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-3 right-3">
            <ScoreGauge score={score} size={36} strokeWidth={2.5} />
          </div>
          {status && (
            <div className="absolute top-3 left-3">
              <Badge variant={statusVariant} size="sm">{status}</Badge>
            </div>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold tracking-tight text-sm mb-1 group-hover:text-accent transition-colors line-clamp-1">
            {title}
          </h3>
          <div className="flex items-center gap-1 text-[10px] text-muted mb-3">
            <MapPin size={10} weight="bold" />
            {address}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted mb-3">
            {area && <span>{area}</span>}
            {rooms && <><span className="w-0.5 h-0.5 rounded-full bg-border" /><span>{rooms}</span></>}
            {days !== undefined && <><span className="w-0.5 h-0.5 rounded-full bg-border" /><span>{days} dní</span></>}
          </div>

          <div className="mt-auto">
            <PriceTag price={price} perSqm={pricePerSqm} size="sm" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
