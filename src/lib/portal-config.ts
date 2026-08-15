import { db } from "@/db";
import { portalConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ts } from "@/lib/utils";

export const FIFTY_FIFTY_NOTICE_DEFAULT =
  "Naše specializovaná řemeslnická parta aktuálně pracuje na jiném projektu — model 50/50 je dočasně pozastaven.";

export interface PortalConfigView {
  fiftyFiftyEnabled: boolean;
  fiftyFiftyNotice: string;
}

const DEFAULT_VIEW: PortalConfigView = {
  fiftyFiftyEnabled: true,
  fiftyFiftyNotice: FIFTY_FIFTY_NOTICE_DEFAULT,
};

export async function getPortalConfig(): Promise<PortalConfigView> {
  try {
    const [row] = await db.select().from(portalConfig).limit(1);
    if (!row) return DEFAULT_VIEW;
    return {
      fiftyFiftyEnabled: (row.fiftyFiftyEnabled ?? 1) === 1,
      fiftyFiftyNotice: row.fiftyFiftyNotice?.trim() ? row.fiftyFiftyNotice : FIFTY_FIFTY_NOTICE_DEFAULT,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

export async function upsertPortalConfig(
  data: { fiftyFiftyEnabled: boolean; fiftyFiftyNotice?: string }
): Promise<PortalConfigView> {
  const now = ts();
  const [existing] = await db.select({ id: portalConfig.id }).from(portalConfig).limit(1);
  if (existing) {
    await db
      .update(portalConfig)
      .set({
        fiftyFiftyEnabled: data.fiftyFiftyEnabled ? 1 : 0,
        fiftyFiftyNotice: data.fiftyFiftyNotice ?? "",
        updatedAt: now,
      })
      .where(eq(portalConfig.id, existing.id));
  } else {
    await db.insert(portalConfig).values({
      id: "global",
      fiftyFiftyEnabled: data.fiftyFiftyEnabled ? 1 : 0,
      fiftyFiftyNotice: data.fiftyFiftyNotice ?? "",
      updatedAt: now,
    });
  }
  return {
    fiftyFiftyEnabled: data.fiftyFiftyEnabled,
    fiftyFiftyNotice: data.fiftyFiftyNotice?.trim() ? data.fiftyFiftyNotice : FIFTY_FIFTY_NOTICE_DEFAULT,
  };
}
