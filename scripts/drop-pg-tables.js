const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL);

async function dropAll() {
  const tables = [
    "activity_log", "alerts", "notifications", "property_analysis",
    "deal_expenses", "deals", "accounts", "call_logs", "call_queue",
    "contacts", "leads", "market_data", "price_history", "properties",
    "scraping_jobs", "sessions", "subscriptions", "user_preferences",
    "users", "verification_tokens"
  ];
  for (const t of tables) {
    try {
      await sql.unsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`);
      console.log("Dropped: " + t);
    } catch (e) {
      console.log("Error dropping " + t + ": " + e.message);
    }
  }
  console.log("\nAll tables dropped. Run drizzle-kit push to recreate.");
  await sql.end();
}

dropAll().catch((e) => { console.error(e); process.exit(1); });
