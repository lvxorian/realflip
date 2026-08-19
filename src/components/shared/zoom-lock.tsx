"use client";

import { useEffect } from "react";

/**
 * Blokuje pinch-zoom a double-tap zoom napříč celou aplikací.
 *
 * iOS Safari ignoruje viewport `maximum-scale=1` / `user-scalable=no`
 * (od iOS 10 je to accessibility rozhodnutí prohlížeče), proto je potřeba
 * zoom blokovat v JS. Jednoprstý scroll/swipe zůstává plně funkční.
 *
 * Vnitřek mapy (Leaflet, `.leaflet-container`) je vyloučen — pinch tam je
 * ovládací prvek mapy, ne zoom stránky (mapa má navíc +/- tlačítka).
 */
export function ZoomLock() {
  useEffect(() => {
    const isWithinMap = (target: EventTarget | null) =>
      target instanceof Element && target.closest(".leaflet-container") != null;

    // Pinch-zoom = 2+ prsty → blokuj move (scroll a swipe jedním prstem zůstávají)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && !isWithinMap(e.target)) e.preventDefault();
    };

    // iOS gesture events (starší Safari řeší pinch i double-tap přes ně)
    const preventGesture = (e: Event) => {
      if (!isWithinMap(e.target)) e.preventDefault();
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);

    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  return null;
}
