import "./_env";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

async function main() {
  if (process.env.DATABASE_URL) {
    // Pooler (-pooler) v transaction mode DDL tiše neaplikuje — DDL musí jít
    // přes přímé (non-pooler) připojení. Host má tvar "...pooler.c-4.eu-central-1..." —
    // odstraněním "-pooler" získáme direct připojení (zůstane ".c-4.").
    const directUrl = process.env.DATABASE_URL.replace("-pooler", "");
    const sql = neon(directUrl);
    const existing = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks'`;
    if (existing.length > 0) {
      console.log("[Neon] tabulka tasks už existuje — přeskočeno");
    } else {
      await sql`
        CREATE TABLE tasks (
          id text PRIMARY KEY NOT NULL,
          user_id text NOT NULL,
          title text NOT NULL,
          description text,
          due_at bigint,
          priority text DEFAULT 'medium' NOT NULL,
          done integer DEFAULT 0 NOT NULL,
          created_at bigint NOT NULL,
          updated_at bigint NOT NULL,
          CONSTRAINT tasks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
        )
      `;
      console.log("[Neon] vytvořena tabulka tasks");
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
      const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[];
      if (cols.length > 0) {
        console.log("[SQLite] tabulka tasks už existuje — přeskočeno");
      } else {
        db.exec(`
          CREATE TABLE tasks (
            id text PRIMARY KEY NOT NULL,
            user_id text NOT NULL,
            title text NOT NULL,
            description text,
            due_at integer,
            priority text DEFAULT 'medium' NOT NULL,
            done integer DEFAULT 0 NOT NULL,
            created_at integer NOT NULL,
            updated_at integer NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
          )
        `);
        console.log("[SQLite] vytvořena tabulka tasks");
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