import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { properties } from "./properties";

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  contactId: text("contact_id"),
  stage: text("stage").default("new").notNull(),
  priority: integer("priority").default(0),
  notes: text("notes"),
  assignedTo: text("assigned_to"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  type: text("type").default("agent"),
  tags: text("tags").default("[]"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const callQueue = sqliteTable("call_queue", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  scheduledAt: integer("scheduled_at"),
  priority: integer("priority").default(0),
  status: text("status").default("pending"),
  attempts: integer("attempts").default(0),
  createdAt: integer("created_at").notNull(),
});

export const callLogs = sqliteTable("call_logs", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  contactId: text("contact_id"),
  calledAt: integer("called_at").notNull(),
  duration: integer("duration"),
  outcome: text("outcome"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});
