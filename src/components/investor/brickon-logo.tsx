"use client";

import { useState } from "react";

interface BrickonLogoProps {
  size?: number;
  tone?: "light" | "brand";
  className?: string;
}

export function BrickonLogo({ size = 28, tone = "light", className }: BrickonLogoProps) {
  const [src, setSrc] = useState("/brickon.svg");

  return (
    <img
      src={src}
      alt="Brickon"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      data-logo="brickon"
      onError={() => setSrc((current) => (current === "/brickon.svg" ? "/brickon.png" : current))}
      loading="eager"
      decoding="async"
    />
  );
}
