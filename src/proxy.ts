import { auth } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";

const INVESTOR_ONLY = process.env.INVESTOR_ONLY === "1";
const INVESTOR_PORTAL_URL = process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL?.replace(/\/+$/, "");

function isInvestorPath(pathname: string): boolean {
  return (
    pathname === "/investor" ||
    pathname.startsWith("/investor/") ||
    pathname.startsWith("/api/investor-portal")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Brickon — samostatná instance investorského portálu (INVESTOR_ONLY=1).
  // Slouží výhradně investorům: povoleny landing (`/`), investorské cesty
  // a nic jiného (admin, API, atd.) zde nesmí být dostupné.
  if (INVESTOR_ONLY) {
    if (isInvestorPath(pathname) || pathname === "/") return;
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse("Not found", { status: 404 });
  }

  // Hlavní aplikace (RealFlip): investorský portál žije na Brickonu.
  // S nastavenou portálovou URL stránky přesměrujeme a API portálu zde
  // vrací 404. Bez nakonfigurované URL (lokální vývoj) portál funguje
  // i na hlavní instanci — nic se nerozbije.
  if (isInvestorPath(pathname)) {
    if (INVESTOR_PORTAL_URL) {
      if (pathname.startsWith("/investor")) {
        return NextResponse.redirect(`${INVESTOR_PORTAL_URL}${pathname}`);
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return;
  }

  const isLoggedIn = !!req.auth;

  const publicRoutes = ["/", "/login", "/register", "/api/auth"];
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
  const isApiRoute = pathname.startsWith("/api");

  if (isPublic) return;

  if (isApiRoute) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return;
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|json|js|css|map|woff2|woff|ttf|eot)|public).*)",
  ],
};
