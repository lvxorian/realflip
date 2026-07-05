import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/pg/*",
  out: "./src/db/migrations-pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
