import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const channelConfigTable = pgTable("channel_config", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().default(1),
  channels: jsonb("channels").notNull().default([]),
});

export const sendRulesTable = pgTable("send_rules", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().default(1),
  sendWindowStart: text("send_window_start").notNull().default("09:00"),
  sendWindowEnd: text("send_window_end").notNull().default("21:00"),
  frequencyCap: integer("frequency_cap").notNull().default(3),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("info"),
  read: text("read").notNull().default("false"),
  createdAt: text("created_at").notNull(),
});

export const sessionTable = pgTable("session_store", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
