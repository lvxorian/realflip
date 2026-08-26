import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const insolvencyEvents = sqliteTable("insolvency_events", {
  id: text("id").primaryKey(),
  podnetId: integer("podnet_id").notNull().unique(),
  spisovaZnacka: text("spisova_znacka").notNull(),
  court: text("court"),
  eventType: text("event_type").notNull(),
  eventDesc: text("event_desc"),
  section: text("section"),
  sectionOrder: integer("section_order"),
  documentUrl: text("document_url"),
  notes: text("notes"),
  publishedAt: integer("published_at").notNull(),
  apartmentFound: integer("apartment_found").default(0).notNull(),
  apartmentData: text("apartment_data").default("{}"),
  score: integer("score").default(0).notNull(),
  status: text("status").default("new").notNull(),
  notesUser: text("notes_user"),
  contactedAt: integer("contacted_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const isirPolls = sqliteTable("isir_polls", {
  id: text("id").primaryKey(),
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  lastPodnetId: integer("last_podnet_id"),
  eventsFound: integer("events_found").default(0).notNull(),
  apartmentsFound: integer("apartments_found").default(0).notNull(),
  error: text("error"),
  status: text("status").default("running").notNull(),
});
