import { db } from "@/db";
import { investors } from "@/db/schema";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

const TOUCH_THROTTLE_MS = 60 * 1000;

export async function touchInvestorActivity(investorId: string): Promise<void> {
  const now = Date.now();
  await db
    .update(investors)
    .set({ lastActiveAt: now })
    .where(
      and(
        eq(investors.id, investorId),
        or(isNull(investors.lastActiveAt), lt(investors.lastActiveAt, now - TOUCH_THROTTLE_MS))
      )
    );
}

export async function recordInvestorLogin(investorId: string): Promise<void> {
  await db
    .update(investors)
    .set({ lastActiveAt: Date.now(), loginCount: sql`${investors.loginCount} + 1` })
    .where(eq(investors.id, investorId));
}
