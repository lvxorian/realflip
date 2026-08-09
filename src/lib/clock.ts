/**
 * „Hodiny" pro UI komponenty — cache `Date.now()`, aktualizovaná periodicky.
 * React pravidlo purity zakazuje volat impure funkce (Date.now) přímo v renderu,
 * proto karta/sloupec čtou currentTime() — hodnotu, která se obnovuje každých
 * 30 s bez vyvolání re-renderů.
 */
let cachedNow = Date.now();

if (typeof window !== "undefined" && typeof setInterval === "function") {
  setInterval(() => {
    cachedNow = Date.now();
  }, 30_000);
}

export function currentTime(): number {
  return cachedNow;
}