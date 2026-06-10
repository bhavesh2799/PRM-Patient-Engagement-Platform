import { pgTable, text, serial, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email"),
  uhid: text("uhid"),
  specialization: text("specialization"),
  sourceChannel: text("source_channel").notNull(),
  status: text("status").notNull().default("new"),
  moduleStage: text("module_stage"),
  transactionContext: jsonb("transaction_context").$type<Record<string, unknown>>(),
  ownerUserId: integer("owner_user_id"),
  sourceListTag: text("source_list_tag"),
  optedIn: boolean("opted_in").notNull().default(true),
  dndListed: boolean("dnd_listed").notNull().default(false),
  hasActiveSession: boolean("has_active_session").notNull().default(false),
  sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }),
  lastVisitDate: text("last_visit_date"),
  tags: jsonb("tags").default([]).$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActionAt: timestamp("last_action_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  userId: integer("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  direction: text("direction").notNull(),
  body: text("body").notNull(),
  subject: text("subject"),
  channel: text("channel").notNull(),
  templateId: integer("template_id"),
  status: text("status").notNull().default("sent"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, lastActionAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, timestamp: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
