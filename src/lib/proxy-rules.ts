// Čistě testovatelná pravidla pro src/proxy.ts (Next 16 náhrada middleware).
// Historická chyba: `pathname.startsWith("/")` odpovídalo na vše → mrtvý auth gate.

const PUBLIC_EXACT = ["/", "/vop"];
const PUBLIC_PREFIXES = ["/login", "/register", "/api/auth", "/report"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

// Strojem volané API (Vercel cron GET, GitHub Actions, Python hunter) — přicházejí
// bez session cookie a každá route se autentizuje sama vlastním secretem
// (CRON_SECRET Bearer / x-cron-secret / VYKUPY_API_TOKEN). Na hraně musí projít.
const MACHINE_EXACT = [
  "/api/scraping/trigger",
  "/api/deska/poll",
  "/api/isir/cron",
  "/api/ares/cron",
  "/api/realingo/cron",
  "/api/market/radar-refresh",
  "/api/vykupy/leads",
];

export function isMachinePath(pathname: string): boolean {
  return MACHINE_EXACT.includes(pathname);
}

export function isStaticAsset(pathname: string): boolean {
  return (
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/public/") ||
    /\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|json|js|css|map|woff2|woff|ttf|eot|mp4|webm|m4v)$/i.test(
      pathname
    )
  );
}

export function isInvestorPath(pathname: string): boolean {
  return (
    pathname === "/investor" ||
    pathname.startsWith("/investor/") ||
    pathname.startsWith("/api/investor-portal")
  );
}
