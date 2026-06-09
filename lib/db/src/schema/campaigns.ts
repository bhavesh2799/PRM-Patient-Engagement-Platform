import { pgTable, text, serial, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  goal: text("goal").notNull(),
  audienceSegmentId: integer("audience_segment_id").notNull(),
  channels: jsonb("channels").notNull().default([]),
  estimatedRecipients: integer("estimated_recipients"),
  costBreakdown: jsonb("cost_breakdown"),
  status: text("status").notNull().default("draft"),
  complianceResult: jsonb("compliance_result"),
  createdBy: integer("created_by").notNull(),
  approvedBy: integer("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
});

export const campaignMetricsTable = pgTable("campaign_metrics", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().unique(),
  sent: integer("sent").notNull().default(0),
  delivered: integer("delivered").notNull().default(0),
  opened: integer("opened").notNull().default(0),
  clicked: integer("clicked").notNull().default(0),
  converted: integer("converted").notNull().default(0),
  spend: numeric("spend", { precision: 12, scale: 2 }).notNull().default("0"),
  revenueAttributed: numeric("revenue_attributed", { precision: 12, scale: 2 }).notNull().default("0"),
  channelBreakdown: jsonb("channel_breakdown").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

export const insertCampaignMetricsSchema = createInsertSchema(campaignMetricsTable).omit({ id: true, updatedAt: true });
export type InsertCampaignMetrics = z.infer<typeof insertCampaignMetricsSchema>;
export type CampaignMetrics = typeof campaignMetricsTable.$inferSelect;
