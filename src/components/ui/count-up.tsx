"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  formatter?: (value: number) => string;
}

export function CountUp({
  end,
  duration = 2,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  formatter,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const controls = useAnimation();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true;
      controls.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5 },
      });

      if (ref.current) {
        const startTime = Date.now();
        const startValue = 0;

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / (duration * 1000), 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = startValue + (end - startValue) * eased;

          if (ref.current) {
            const value = formatter ? formatter(current) : current.toFixed(decimals);
            ref.current.textContent = `${prefix}${value}${suffix}`;
          }

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };

        animate();
      }
    }
  }, [isInView, end, duration, prefix, suffix, decimals, controls, formatter]);

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={controls}
      className={className}
    >
      {prefix}0{suffix}
    </motion.span>
  );
}
