"use client";

import { motion, useMotionValue, useTransform, useInView } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function ScoreGauge({
  score,
  size = 48,
  strokeWidth = 3,
  className,
  showLabel = true,
}: ScoreGaugeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const progress = useMotionValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = useTransform(progress, [0, 100], [circumference, 0]);

  useEffect(() => {
    if (!inView) return;
    progress.set(0);
    const timeout = setTimeout(() => progress.set(score), 100);
    return () => clearTimeout(timeout);
  }, [inView, score, progress]);

  const color =
    score >= 80 ? "stroke-emerald-400" :
    score >= 60 ? "stroke-accent" :
    score >= 40 ? "stroke-amber-400" :
    "stroke-red-400";

  const textColor =
    score >= 80 ? "text-emerald-400" :
    score >= 60 ? "text-accent" :
    score >= 40 ? "text-amber-400" :
    "text-red-400";

  return (
    <div ref={ref} className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="gauge-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border/50"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
          className={color}
        />
      </svg>
      {showLabel && (
        <span className={cn("absolute text-xs font-mono font-semibold", textColor)}>
          {score}
        </span>
      )}
    </div>
  );
}
