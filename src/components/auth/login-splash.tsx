"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";

interface LoginSplashProps {
  show: boolean;
  /** Zavolá se, když video dokončí první celý průchod (i když se loopuje dál). */
  onPlayedOnce?: () => void;
}

/**
 * Celostránková splash obrazovka — přehrává brandovou animaci RealFlipu
 * (public/realflip-animation.mp4) po dobu přihlašování. Video pokrývá celé
 * okno (object-cover) a loopuje se, takže ani při pomalém loginu nezamrzne
 * na posledním snímku. Přes `onPlayedOnce` hlásí rodiči, že video proběhlo
 * celé jednou, aby se mohlo pokračovat dál (ne dřív).
 */
export function LoginSplash({ show, onPlayedOnce }: LoginSplashProps) {
  const reported = useRef(false);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (reported.current || !onPlayedOnce) return;
    const v = e.currentTarget;
    // Konec prvního průchodu (s malou tolerancí kvůli zaokrouhlení časů).
    if (v.duration > 0 && v.currentTime >= v.duration - 0.25) {
      reported.current = true;
      onPlayedOnce();
    }
  };

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
          className="fixed inset-0 z-50 overflow-hidden bg-black"
        >
          {/* Video přes celý displej */}
          <video
            src="/realflip-animation.mp4"
            poster="/realflip-animation-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
            onTimeUpdate={handleTimeUpdate}
            onError={onPlayedOnce}
          />

          {/* Jemný overlay pro čitelnost textu */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          {/* Text přes video */}
          <div className="absolute inset-x-0 bottom-10 flex justify-center">
            <div className="flex items-center gap-2.5 rounded-full bg-black/55 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-white">
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
