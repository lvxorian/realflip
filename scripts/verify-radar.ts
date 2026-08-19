import "./_env";
import { db } from "@/db";
import { radarSeries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { refreshMacroSeries } from "@/lib/market/macro";
import { refreshCzsoSeries } from "@/lib/market/czso-radar";

async function main() {
  console.log("=== makro refresh ===");
  const macro = await refreshMacroSeries();
  console.log("macro:", macro);

  const cpi = await db
    .select({ period: radarSeries.period, value: radarSeries.value })
    .from(radarSeries)
    .where(eq(radarSeries.indicator, "cpi_yoy"))
    .orderBy(desc(radarSeries.period))
    .limit(2);
  const cpiAll = await db.select().from(radarSeries).where(eq(radarSeries.indicator, "cpi_yoy"));
  console.log("cpi_yoy celkem:", cpiAll.length, "poslední:", JSON.stringify(cpi));

  console.log("=== ČSÚ refresh ===");
  const czso = await refreshCzsoSeries(
    cpiAll.map((r) => [r.period, r.value] as [string, number])
  );
  console.log("czso:", czso);

  const sample = await db
    .select()
    .from(radarSeries)
    .where(eq(radarSeries.indicator, "repo_rate"))
    .orderBy(desc(radarSeries.period))
    .limit(3);
  console.log("repo_rate poslední:", JSON.stringify(sample));

  const flats = await db
    .select({ regionKey: radarSeries.regionKey, period: radarSeries.period, value: radarSeries.value })
    .from(radarSeries)
    .where(eq(radarSeries.indicator, "started_flats"))
    .orderBy(desc(radarSeries.period))
    .limit(5);
  console.log("started_flats poslední:", JSON.stringify(flats));

  const wages = await db
    .select({ regionKey: radarSeries.regionKey, period: radarSeries.period, value: radarSeries.value })
    .from(radarSeries)
    .where(eq(radarSeries.indicator, "avg_wage"))
    .orderBy(desc(radarSeries.period))
    .limit(5);
  console.log("avg_wage poslední:", JSON.stringify(wages));

  const real = await db
    .select({ regionKey: radarSeries.regionKey, period: radarSeries.period, value: radarSeries.value })
    .from(radarSeries)
    .where(eq(radarSeries.indicator, "real_wage_yoy"))
    .orderBy(desc(radarSeries.period))
    .limit(5);
  console.log("real_wage_yoy poslední:", JSON.stringify(real));

  const pop = await db
    .select({ regionKey: radarSeries.regionKey, period: radarSeries.period, value: radarSeries.value })
    .from(radarSeries)
    .where(eq(radarSeries.indicator, "pop_growth"))
    .orderBy(desc(radarSeries.period))
    .limit(5);
  console.log("pop_growth poslední:", JSON.stringify(pop));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});