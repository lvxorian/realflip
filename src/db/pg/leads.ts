import { pgTable, text, integer, bigint } from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { users } from "./users";

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  contactId: text("contact_id"),
  stage: text("stage").default("new").notNull(),
  priority: integer("priority").default(0),
  notes: text("notes"),
  assignedTo: text("assigned_to"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  type: text("type").default("agent"),
  tags: text("tags").default("[]"),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const callQueue = pgTable("call_queue", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  scheduledAt: bigint("scheduled_at", { mode: "number" }),
  priority: integer("priority").default(0),
  status: text("status").default("pending"),
  attempts: integer("attempts").default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const callLogs = pgTable("call_logs", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  contactId: text("contact_id"),
  calledAt: bigint("called_at", { mode: "number" }).notNull(),
  duration: integer("duration"),
  outcome: text("outcome"),
  notes: text("notes"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
