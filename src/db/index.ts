import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schemaType from "./schema";
import type * as pgSchemaType from "./pg";

type LocalDb = BetterSQLite3Database<typeof schemaType>;
type CloudDb = NeonHttpDatabase<typeof pgSchemaType>;

let _db: LocalDb | CloudDb;
let _schema: typeof schemaType | typeof pgSchemaType;

if (process.env.DATABASE_URL) {
  const { neon } = require("@neondatabase/serverless");
  const { drizzle } = require("drizzle-orm/neon-http");
  _schema = require("./pg");
  const sql = neon(process.env.DATABASE_URL);
  _db = drizzle(sql, { schema: _schema });
} else {
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  _schema = require("./schema");
  const sqlite = new Database("data.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _db = drizzle(sqlite, { schema: _schema });
}

export const db = _db;
export const schema = _schema;
