"use client";

interface BrickonLogoProps {
  size?: number;
  tone?: "light" | "brand";
  className?: string;
}

export function BrickonLogo({ size = 28, tone = "light", className }: { size?: number; tone?: "light" | "brand"; className?: string }) {
  return (
    <img
      src="/brickon.png"
      alt="Brickon"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
    />
  );
}
