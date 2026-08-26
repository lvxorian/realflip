import { pgTable, text, bigint, integer, jsonb } from "drizzle-orm/pg-core";

export const insolvencyEvents = pgTable("insolvency_events", {
  id: text("id").primaryKey(),
  podnetId: bigint("podnet_id", { mode: "number" }).notNull().unique(),
  spisovaZnacka: text("spisova_znacka").notNull(),
  court: text("court"),
  eventType: text("event_type").notNull(),
  eventDesc: text("event_desc"),
  section: text("section"),
  sectionOrder: integer("section_order"),
  documentUrl: text("document_url"),
  notes: text("notes"),
  publishedAt: bigint("published_at", { mode: "number" }).notNull(),
  apartmentFound: integer("apartment_found").default(0).notNull(),
  apartmentData: jsonb("apartment_data").default("{}"),
  score: integer("score").default(0).notNull(),
  status: text("status").default("new").notNull(),
  notesUser: text("notes_user"),
  contactedAt: bigint("contacted_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const isirPolls = pgTable("isir_polls", {
  id: text("id").primaryKey(),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  finishedAt: bigint("finished_at", { mode: "number" }),
  lastPodnetId: bigint("last_podnet_id", { mode: "number" }),
  eventsFound: integer("events_found").default(0).notNull(),
  apartmentsFound: integer("apartments_found").default(0).notNull(),
  error: text("error"),
  status: text("status").default("running").notNull(),
});
