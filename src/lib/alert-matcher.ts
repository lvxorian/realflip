import { db } from "@/db";
import { alerts, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

interface PriceDropRule {
  type: "price_drop";
  minDropPct: number;
}

interface ScoreThresholdRule {
  type: "score_threshold";
  minScore: number;
}

type AlertRule = PriceDropRule | ScoreThresholdRule;

export async function checkPriceDropAlert(
  propertyId: string,
  title: string,
  url: string,
  oldPrice: number,
  newPrice: number
): Promise<void> {
  if (newPrice >= oldPrice) return;

  const dropPct = ((oldPrice - newPrice) / oldPrice) * 100;

  const activeAlerts = await db
    .select()
    .from(alerts)
    .where(eq(alerts.isActive, 1));

  for (const alert of activeAlerts) {
    let rule: AlertRule | null = null;
    try {
      rule = JSON.parse(alert.rules ?? "{}") as AlertRule;
    } catch {
      continue;
    }

    if (!rule || rule.type !== "price_drop") continue;
    if (dropPct < rule.minDropPct) continue;

    const now = ts();

    try {
      await db.insert(notifications).values({
        id: generateId(),
        userId: alert.userId,
        title: "Cenový drop",
        message: `${title} – cena klesla o ${dropPct.toFixed(1)}% (${newPrice.toLocaleString()} Kč)`,
        type: "price_drop",
        data: JSON.stringify({ propertyId, url, oldPrice, newPrice, dropPct }),
        createdAt: now,
      });

      await db
        .update(alerts)
        .set({ lastTriggered: now })
        .where(eq(alerts.id, alert.id));
    } catch {
      // notification insert is optional
    }
  }
}
