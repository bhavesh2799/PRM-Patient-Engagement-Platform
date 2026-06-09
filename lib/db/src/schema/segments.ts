import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const segmentsTable = pgTable("segments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  source: text("source").notNull().default("manual"),
  conditionTree: text("condition_tree"),
  memberLeadIds: jsonb("member_lead_ids").notNull().default([]),
  count: integer("count").notNull().default(0),
  lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSegmentSchema = createInsertSchema(segmentsTable).omit({ id: true, createdAt: true, lastRefreshAt: true });
export type InsertSegment = z.infer<typeof insertSegmentSchema>;
export type Segment = typeof segmentsTable.$inferSelect;
