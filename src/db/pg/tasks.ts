import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";
import { users } from "./users";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: bigint("due_at", { mode: "number" }),
  priority: text("priority").default("medium").notNull(),
  done: integer("done").default(0).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});