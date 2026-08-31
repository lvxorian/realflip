import { pgTable, text, bigint, integer, jsonb } from "drizzle-orm/pg-core";

export const aresCompanies = pgTable("ares_companies", {
  id: text("id").primaryKey(),
  ico: text("ico").notNull().unique(),
  name: text("name"),
  legalForm: text("legal_form"),
  sidlo: text("sidlo"),
  court: text("court"),
  spisovaZnacka: text("spisova_znacka"),
  status: text("status").default("LIKVIDACE").notNull(),
  liquidationDate: bigint("liquidation_date", { mode: "number" }),
  lastUpdatedAres: bigint("last_updated_ares", { mode: "number" }),
  reasoning: text("reasoning"),
  isLiquidating: integer("is_liquidating").default(1).notNull(),
  hasExecution: integer("has_execution").default(0).notNull(),
  propertyOwned: jsonb("property_owned").default("{}"),
  propertyVerified: integer("property_verified").default(0).notNull(),
  apartmentFound: integer("apartment_found").default(0).notNull(),
  score: integer("score").default(0).notNull(),
  pipeline: text("pipeline").default("new").notNull(),
  notesUser: text("notes_user"),
  contactedAt: bigint("contacted_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const aresPolls = pgTable("ares_polls", {
  id: text("id").primaryKey(),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  finishedAt: bigint("finished_at", { mode: "number" }),
  lastBatchId: integer("last_batch_id"),
  lastIcoIndex: integer("last_ico_index").default(0).notNull(),
  companiesScanned: integer("companies_scanned").default(0).notNull(),
  liquidationsFound: integer("liquidations_found").default(0).notNull(),
  apartmentsFound: integer("apartments_found").default(0).notNull(),
  error: text("error"),
  status: text("status").default("running").notNull(),
});
