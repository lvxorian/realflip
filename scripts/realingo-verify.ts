import "./_env";
import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { eq, sql, count } from "drizzle-orm";

async function main() {
  const stats = await db
    .select({
      total: count(),
      withPhoto: count(sql`case when jsonb_array_length("image_urls"::jsonb) > 0 then 1 end`),
      withRating: count(sql`case when "price_rating" is not null and "price_rating" <> '' then 1 end`),
      legacyTitle: count(sql`case when "title" like 'SELL%' or "title" like 'RENT%' then 1 end`),
      newTitle: count(sql`case when "title" like 'Prodej%' or "title" like 'Pronájem%' then 1 end`),
    })
    .from(properties)
    .where(eq(properties.portalName, "realingo"));
  console.log("realingo rows:", JSON.stringify(stats[0]));

  const sample = await db
    .select({
      title: properties.title,
      address: properties.address,
      rooms: properties.rooms,
      imgs: sql<number>`jsonb_array_length("image_urls"::jsonb)`,
      rating: properties.priceRating,
    })
    .from(properties)
    .where(eq(properties.portalName, "realingo"))
    .orderBy(sql`${properties.firstSeen} desc`)
    .limit(6);
  for (const r of sample) {
    console.log(`- "${r.title}" | addr=${JSON.stringify(r.address)} | rooms=${JSON.stringify(r.rooms)} | imgs=${r.imgs} | rating=${JSON.stringify(r.rating)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
