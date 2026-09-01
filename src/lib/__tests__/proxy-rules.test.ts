import { describe, it, expect } from "vitest";
import { isPublicPath, isMachinePath, isInvestorPath, isStaticAsset } from "@/lib/proxy-rules";

describe("isPublicPath", () => {
  it("veřejné cesty přesně", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/vop")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/api/auth")).toBe(true);
    expect(isPublicPath("/api/auth/callback/google")).toBe(true);
    expect(isPublicPath("/report/abc-123")).toBe(true);
    expect(isPublicPath("/report/valuation")).toBe(true);
  });

  it("chráněné cesty NESMÍ projít jako veřejné (regrese startsWith('/') bugu)", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/api/leads")).toBe(false);
    expect(isPublicPath("/api/properties/123")).toBe(false);
    expect(isPublicPath("/api/settings/profile")).toBe(false);
    expect(isPublicPath("/api/parse-auction")).toBe(false);
    expect(isPublicPath("/api/market/radar")).toBe(false);
    expect(isPublicPath("/properties/123")).toBe(false);
    expect(isPublicPath("/investors")).toBe(false);
  });

  it("předpona musí být kompletní segment, ne substring", () => {
    expect(isPublicPath("/login-history")).toBe(false);
    expect(isPublicPath("/registrace")).toBe(false);
    expect(isPublicPath("/api/authorize")).toBe(false);
    expect(isPublicPath("/reporty")).toBe(false);
  });
});

describe("isMachinePath", () => {
  it("cron/akční endpointy bez cookie projdou hranou", () => {
    expect(isMachinePath("/api/scraping/trigger")).toBe(true);
    expect(isMachinePath("/api/deska/poll")).toBe(true);
    expect(isMachinePath("/api/isir/cron")).toBe(true);
    expect(isMachinePath("/api/ares/cron")).toBe(true);
    expect(isMachinePath("/api/realingo/cron")).toBe(true);
    expect(isMachinePath("/api/market/radar-refresh")).toBe(true);
    expect(isMachinePath("/api/vykupy/leads")).toBe(true);
  });

  it("sourozenci s session auth zůstanou za branou", () => {
    expect(isMachinePath("/api/scraping/status")).toBe(false);
    expect(isMachinePath("/api/isir/documents")).toBe(false);
    expect(isMachinePath("/api/realingo/config")).toBe(false);
    expect(isMachinePath("/api/realingo/trigger")).toBe(false);
    expect(isMachinePath("/api/ares/companies")).toBe(false);
    expect(isMachinePath("/api/market/radar")).toBe(false);
    expect(isMachinePath("/api/market/report")).toBe(false);
    expect(isMachinePath("/api/deska/search")).toBe(false);
  });
});

describe("isInvestorPath", () => {
  it("portál + jeho API", () => {
    expect(isInvestorPath("/investor")).toBe(true);
    expect(isInvestorPath("/investor/nejaka-obrazovka")).toBe(true);
    expect(isInvestorPath("/api/investor-portal/login")).toBe(true);
  });
  it("admin sekce Investoři není portál", () => {
    expect(isInvestorPath("/investors")).toBe(false);
    expect(isInvestorPath("/api/investors")).toBe(false);
  });
});

describe("isStaticAsset", () => {
  it("assety", () => {
    expect(isStaticAsset("/favicon.ico")).toBe(true);
    expect(isStaticAsset("/_next/static/chunks/app.js")).toBe(true);
    expect(isStaticAsset("/realflip-animation.mp4")).toBe(true); // splash video před loginem
    expect(isStaticAsset("/brickon.png")).toBe(true);
  });

  it("stránky ani API nejsou asset", () => {
    expect(isStaticAsset("/dashboard")).toBe(false);
    expect(isStaticAsset("/api/leads")).toBe(false);
  });
});
