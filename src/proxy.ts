import { auth } from "@/lib/auth-middleware";
import { NextResponse } from "next/server";
import { isPublicPath, isMachinePath, isInvestorPath, isStaticAsset } from "@/lib/proxy-rules";

const INVESTOR_ONLY = process.env.INVESTOR_ONLY === "1";
const INVESTOR_PORTAL_URL = process.env.NEXT_PUBLIC_INVESTOR_PORTAL_URL?.replace(/\/+$/, "");

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isStaticAsset(pathname)) return;

  // Brickon — samostatná instance investorského portálu (INVESTOR_ONLY=1).
  // Slouží výhradně investorům: povoleny landing (`/`), investorské cesty
  // a nic jiného (admin, API, atd.) zde nesmí být dostupné.
  if (INVESTOR_ONLY) {
    if (isInvestorPath(pathname) || pathname === "/" || pathname === "/vop") return;
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

  const isPublic = isPublicPath(pathname);
  const isApiRoute = pathname.startsWith("/api");

  // Cron/akce volané strojem bez cookie — route si ověří svůj secret sama.
  if (isMachinePath(pathname)) return;

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
  matcher: ["/:path*"],
};
