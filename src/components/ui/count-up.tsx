"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  formatter?: (value: number) => string;
}

export function CountUp({
  end,
  duration = 1.5,
  prefix = "",
  suffix = "",
  decimals = 0,
  formatter,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState(0);
  const startTime = useRef<number>(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!inView) return;

    function animate(time: number) {
      if (!startTime.current) startTime.current = time;
      const elapsed = (time - startTime.current) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(eased * end);

      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      }
    }

    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [inView, end, duration]);

  const formatted = formatter
    ? formatter(displayed)
    : displayed.toFixed(decimals);

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
}
