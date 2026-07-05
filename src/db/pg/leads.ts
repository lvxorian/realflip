import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  contactId: text("contact_id"),
  stage: text("stage").default("new").notNull(),
  priority: integer("priority").default(0),
  notes: text("notes"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  type: text("type").default("agent"),
  tags: text("tags").default("[]"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const callQueue = pgTable("call_queue", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at"),
  priority: integer("priority").default(0),
  status: text("status").default("pending"),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").notNull(),
});

export const callLogs = pgTable("call_logs", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  contactId: text("contact_id"),
  calledAt: timestamp("called_at").notNull(),
  duration: integer("duration"),
  outcome: text("outcome"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull(),
});
