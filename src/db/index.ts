import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schemaType from "./schema";

type DbType = BetterSQLite3Database<typeof schemaType>;

function initDb(): { db: DbType; schema: typeof schemaType } {
  if (process.env.DATABASE_URL) {
    const { neon } = require("@neondatabase/serverless");
    const { drizzle } = require("drizzle-orm/neon-http");
    const pgSchema: typeof schemaType = require("./pg");
    const sql = neon(process.env.DATABASE_URL);
    return { db: drizzle(sql, { schema: pgSchema }) as unknown as DbType, schema: pgSchema };
  }

  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const sqliteSchema: typeof schemaType = require("./schema");
  const sqlite = new Database("data.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { db: drizzle(sqlite, { schema: sqliteSchema }) as unknown as DbType, schema: sqliteSchema };
}

const { db: _db, schema: _schema } = initDb();

export const db: DbType = _db;
export const schema: typeof schemaType = _schema;
