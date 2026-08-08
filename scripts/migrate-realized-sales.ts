import "./_env";
import { Pool } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const PG_DDL = `
CREATE TABLE IF NOT EXISTS "realized_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE cascade,
	"url" text,
	"portal_name" text,
	"title" text,
	"price" integer NOT NULL,
	"price_per_sqm" real,
	"area" real,
	"rooms" text,
	"condition" text,
	"building_type" text,
	"address" text,
	"lat" real,
	"lng" real,
	"sold_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "realized_sales_sold_at_idx" ON "realized_sales" ("sold_at");
`;

const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS "realized_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL REFERENCES "properties"("id") ON DELETE cascade,
	"url" text,
	"portal_name" text,
	"title" text,
	"price" integer NOT NULL,
	"price_per_sqm" real,
	"area" real,
	"rooms" text,
	"condition" text,
	"building_type" text,
	"address" text,
	"lat" real,
	"lng" real,
	"sold_at" integer NOT NULL,
	"created_at" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "realized_sales_sold_at_idx" ON "realized_sales" ("sold_at");
`;

async function main() {
  if (process.env.DATABASE_URL) {
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const pool = new Pool({ connectionString: directUrl });
    try {
      const existing = await pool.query(
        "SELECT to_regclass('public.realized_sales') AS name"
      );
      if (existing.rows[0]?.name) {
        console.log("[Neon] tabulka realized_sales už existuje — přeskočeno");
      } else {
        await pool.query(PG_DDL);
        const check = await pool.query(
          "SELECT to_regclass('public.realized_sales') AS name"
        );
        if (check.rows[0]?.name) {
          console.log("[Neon] vytvořena tabulka realized_sales (ověřeno)");
        } else {
          throw new Error("CREATE TABLE proběhl, ale tabulka se neobjevila");
        }
      }
    } finally {
      await pool.end();
    }
  } else {
    console.log("[Neon] DATABASE_URL nenalezen — Neon přeskočen");
  }

  const dbPath = path.join(process.cwd(), "data.db");
  if (process.env.DATABASE_URL) {
    console.log(`[SQLite] ${dbPath} přeskočen (cloud režim)`);
  } else if (process.env.NODE_ENV !== "production") {
    if (!fs.existsSync(dbPath)) {
      console.log(`[SQLite] ${dbPath} neexistuje — přeskočeno`);
    } else {
      const db = new Database(dbPath);
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='realized_sales'`)
        .all() as { name: string }[];
      if (tables.length > 0) {
        console.log("[SQLite] tabulka realized_sales už existuje — přeskočeno");
      } else {
        db.exec(SQLITE_DDL);
        const check = db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='realized_sales'`)
          .all() as { name: string }[];
        if (check.length > 0) {
          console.log("[SQLite] vytvořena tabulka realized_sales (ověřeno)");
        } else {
          throw new Error("CREATE TABLE proběhl, ale tabulka se neobjevila");
        }
      }
      db.close();
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
