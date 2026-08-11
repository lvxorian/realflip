"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * Celostránková splash obrazovka — přehrává brandovou animaci RealFlipu
 * (public/realflip-animation.mp4) po dobu přihlašování. Zobrazuje se
 * přes celé okno, video se opakuje (loop), zvuk je vypnutý kvůli
 * autoplay politikám prohlížečů.
 */
export function LoginSplash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="status"
          aria-label="Přihlašuji se"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
        >
          <div className="w-full max-w-2xl px-6">
            <video
              src="/realflip-animation.mp4"
              poster="/realflip-animation-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="h-auto w-full rounded-2xl"
            />
          </div>

          <div className="mt-8 flex items-center gap-2.5 text-sm text-muted">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Přihlašuji se…
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
