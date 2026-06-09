import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletTable = pgTable("wallet", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().default(1),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  number: text("number").notNull().unique(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  gst: numeric("gst", { precision: 12, scale: 2 }).notNull(),
  pdfUrl: text("pdf_url").notNull().default("#"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({ id: true, createdAt: true });
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
