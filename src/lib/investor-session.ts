import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "investor_session";
const TTL_MS = 7 * 24 * 3600 * 1000;

export interface InvestorSessionPayload {
  sub: string;
  name: string;
  exp: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET required pro investorský portál");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createInvestorSessionToken(investorId: string, name: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: investorId, name, exp: Date.now() + TTL_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyInvestorSessionToken(token: string | null | undefined): InvestorSessionPayload | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as InvestorSessionPayload;
    if (!data.sub || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getInvestorSession(): Promise<InvestorSessionPayload | null> {
  const store = await cookies();
  return verifyInvestorSessionToken(store.get(COOKIE_NAME)?.value ?? null);
}

export async function setInvestorSession(investorId: string, name: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createInvestorSessionToken(investorId, name), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

export async function clearInvestorSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}
