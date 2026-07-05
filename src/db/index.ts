import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schemaType from "./schema";

type DbType = BetterSQLite3Database<typeof schemaType>;

const isCloud = !!process.env.DATABASE_URL;
const m: { db: DbType; schema: typeof schemaType } = isCloud
  ? (require("./neon") as { db: DbType; schema: typeof schemaType })
  : (require("./sqlite") as { db: DbType; schema: typeof schemaType });

export const db = m.db;
export const schema = m.schema;
