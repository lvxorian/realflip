"use client";

import { forwardRef, useCallback, useRef } from "react";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tiltDegree?: number;
  glare?: boolean;
  children: React.ReactNode;
}

export const TiltCard = forwardRef<HTMLDivElement, TiltCardProps>(
  ({ tiltDegree = 10, glare = true, className, children, ...props }, ref) => {
    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const card = cardRef.current;
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -tiltDegree;
        const rotateY = ((x - centerX) / centerX) * tiltDegree;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

        if (glare) {
          const glareX = (x / rect.width) * 100;
          const glareY = (y / rect.height) * 100;
          card.style.setProperty(
            "--glare-position",
            `${glareX}% ${glareY}%`
          );
          card.style.setProperty("--glare-opacity", "1");
        }
      },
      [tiltDegree, glare]
    );

    const handleMouseLeave = useCallback(() => {
      const card = cardRef.current;
      if (!card) return;
      card.style.transform =
        "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
      if (glare) {
        card.style.setProperty("--glare-opacity", "0");
      }
    }, [glare]);

    return (
      <div
        ref={(node) => {
          (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={`transition-transform duration-200 ease-out ${glare ? "relative overflow-hidden" : ""} ${className || ""}`}
        style={{
          transformStyle: "preserve-3d",
          willChange: "transform",
          ...(glare
            ? {
                "--glare-opacity": "0",
                "--glare-position": "50% 50%",
                backgroundImage:
                  "radial-gradient(circle at var(--glare-position), rgba(255,255,255,0.1) 0%, transparent 60%)",
                backgroundSize: "200% 200%",
              } as React.CSSProperties
            : {}),
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TiltCard.displayName = "TiltCard";
