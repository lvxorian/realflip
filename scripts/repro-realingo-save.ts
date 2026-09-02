import "./_env";
import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

// Zkusí spočítat a najít realingo řádky; pak se pokusí o RAW insert s řetězci
// obsahující podezřelé bity, aby vyšlo najevo, odkud vemou.
async function main() {
  const urls = [
    "https://www.realingo.cz/prodej/byt-2+1-tusarova-praha/24545002",
    "https://www.realingo.cz/prodej/byt-2+1-karlinske-namesti-praha/24539572",
  ];
  for (const u of urls) {
    const rows = await db.select({ id: properties.id }).from(properties).where(eq(properties.url, u)).limit(1);
    console.log(u, "->", rows.length ? "EXISTUJE (už uložen)" : "NENÍ v DB");
  }

  // otestuj raw insert UTF8 s em-dash a smart quotes, jako posílá analyzer
  const risky = "Krátkodobý pronájem (Airbnb) \u2014 ověřit povolení SVJ \u201cAK\u201d";
  console.log("risky bytes valid utf8?", Buffer.byteLength(risky, "utf8"));

  // zkus přímý insert do property_analysis s risky řetězcem a nech ho selhat
  try {
    const { propertyAnalysis } = await import("../src/db/schema");
    await db
      .insert(propertyAnalysis)
      .values({
        id: "test-utf8-" + Date.now(),
        propertyId: "nonexistent-prop",
        verdictSummary: risky,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as never);
    console.log("insert OK (cleany UTF8 projde)");
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string } };
    console.log("insert selhal:", err.message, "\n  cause:", err.cause?.message);
  }
  await db.execute("delete from property_analysis where property_id = 'nonexistent-prop'" as never);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
