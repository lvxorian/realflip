"use client";

interface BrickonLogoProps {
  size?: number;
  tone?: "light" | "brand";
  className?: string;
}

export function BrickonLogo({ size = 28, tone = "light", className }: BrickonLogoProps) {
  return (
    <img
      src="/brickon.png"
      alt="Brickon"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      data-logo="brickon"
    />
  );
}
