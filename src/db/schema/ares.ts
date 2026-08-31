import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const aresCompanies = sqliteTable("ares_companies", {
  id: text("id").primaryKey(),
  ico: text("ico").notNull().unique(),
  name: text("name"),
  legalForm: text("legal_form"),
  sidlo: text("sidlo"),
  court: text("court"),
  spisovaZnacka: text("spisova_znacka"),
  status: text("status").default("LIKVIDACE").notNull(),
  liquidationDate: integer("liquidation_date"),
  lastUpdatedAres: integer("last_updated_ares"),
  reasoning: text("reasoning"),
  isLiquidating: integer("is_liquidating").default(1).notNull(),
  hasExecution: integer("has_execution").default(0).notNull(),
  propertyOwned: text("property_owned").default("{}"),
  propertyVerified: integer("property_verified").default(0).notNull(),
  apartmentFound: integer("apartment_found").default(0).notNull(),
  score: integer("score").default(0).notNull(),
  pipeline: text("pipeline").default("new").notNull(),
  notesUser: text("notes_user"),
  contactedAt: integer("contacted_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const aresPolls = sqliteTable("ares_polls", {
  id: text("id").primaryKey(),
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  lastBatchId: integer("last_batch_id"),
  lastIcoIndex: integer("last_ico_index").default(0).notNull(),
  companiesScanned: integer("companies_scanned").default(0).notNull(),
  liquidationsFound: integer("liquidations_found").default(0).notNull(),
  apartmentsFound: integer("apartments_found").default(0).notNull(),
  error: text("error"),
  status: text("status").default("running").notNull(),
});
