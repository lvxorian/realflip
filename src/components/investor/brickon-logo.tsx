"use client";

import { brickInnerMarkup, type BrickTone } from "@/lib/investor-brick";

interface BrickonLogoProps {
  size?: number;
  tone?: BrickTone;
  className?: string;
}

export function BrickonLogo({ size = 28, tone = "light", className }: BrickonLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Brickon"
      data-logo="brickon"
      className={className}
      dangerouslySetInnerHTML={{ __html: brickInnerMarkup(tone) }}
    />
  );
}
