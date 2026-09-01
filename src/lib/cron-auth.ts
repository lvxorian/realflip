import { createHash, timingSafeEqual } from "crypto";

/**
 * Ověření `Authorization: Bearer ${CRON_SECRET}` pro Vercel cron routes.
 * Fail-closed: bez nastaveného CRON_SECRET nepromůže nic
 * (staré srovnání s šablonou `Bearer ${CRON_SECRET}` bez env proměnné
 * akceptovalo hlavičku "Bearer undefined"). Porovnání přes sha256
 * digest → konstantní čas.
 */
export function hasCronBearer(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return digestEquals(header, expected);
}

export function digestEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
