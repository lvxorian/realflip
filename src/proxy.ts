import { auth } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";

const INVESTOR_ONLY = process.env.INVESTOR_ONLY === "1";
const INVESTOR_PORTAL_URL = process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL?.replace(/\/+$/, "");

function isInvestorPath(pathname: string): boolean {
  return pathname.startsWith("/investor") || pathname.startsWith("/api/investor-portal");
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Brickon — samostatná instance investorského portálu (INVESTOR_ONLY=1).
  // Slouží výhradně investorům: povoleny jen investorské cesty, nic jiného
  // (admin, API, atd.) zde nesmí být dostupné.
  if (INVESTOR_ONLY) {
    if (isInvestorPath(pathname)) return;
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse("Not found", { status: 404 });
  }

  // Hlavní aplikace (RealFlip): investorský portál žije na Brickonu.
  // Stránky přesměrujeme na portálovou URL, API portálu zde vrací 404.
  if (isInvestorPath(pathname)) {
    if (pathname.startsWith("/investor") && INVESTOR_PORTAL_URL) {
      return NextResponse.redirect(`${INVESTOR_PORTAL_URL}${pathname}`);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
