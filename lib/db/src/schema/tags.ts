import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tagsTable = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quickRepliesTable = pgTable("quick_replies", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  sortOrder: serial("sort_order"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uploadHistoryTable = pgTable("upload_history", {
  id: serial("id").primaryKey(),
  sourceName: text("source_name").notNull(),
  fileName: text("file_name").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  imported: integer("imported").notNull().default(0),
  merged: integer("merged").notNull().default(0),
  rejected: integer("rejected").notNull().default(0),
  segmentId: integer("segment_id"),
  segmentName: text("segment_name"),
  rejectedRows: text("rejected_rows"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTagSchema = createInsertSchema(tagsTable).omit({ id: true, createdAt: true });
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tagsTable.$inferSelect;

export const insertQuickReplySchema = createInsertSchema(quickRepliesTable).omit({ id: true, createdAt: true });
export type InsertQuickReply = z.infer<typeof insertQuickReplySchema>;
export type QuickReply = typeof quickRepliesTable.$inferSelect;

export const insertUploadHistorySchema = createInsertSchema(uploadHistoryTable).omit({ id: true, createdAt: true });
export type InsertUploadHistory = z.infer<typeof insertUploadHistorySchema>;
export type UploadHistory = typeof uploadHistoryTable.$inferSelect;
