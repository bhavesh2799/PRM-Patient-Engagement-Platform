import { pgTable, text, serial, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  goal: text("goal").notNull(),
  language: text("language").notNull().default("English"),
  body: text("body").notNull(),
  media: text("media"),
  status: text("status").notNull().default("approved"),
  scope: text("scope").notNull().default("global"),
  dltRegisteredBody: text("dlt_registered_body"),
  metaStatus: text("meta_status"),
  qualityRating: text("quality_rating"),
  senderId: text("sender_id"),
  wabaContact: text("waba_contact"),
  perMessageCost: numeric("per_message_cost", { precision: 10, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateRequestsTable = pgTable("template_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  channel: text("channel").notNull(),
  message: text("message").notNull(),
  media: text("media"),
  goal: text("goal").notNull(),
  variables: text("variables"),
  approvalStage: text("approval_stage").notNull().default("ap_marketing"),
  createdBy: text("created_by").notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true, createdAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;

export const insertTemplateRequestSchema = createInsertSchema(templateRequestsTable).omit({ id: true, createdAt: true });
export type InsertTemplateRequest = z.infer<typeof insertTemplateRequestSchema>;
export type TemplateRequest = typeof templateRequestsTable.$inferSelect;
