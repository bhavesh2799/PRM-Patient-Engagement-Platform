import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hospitalTable = pgTable("hospital", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  primaryColor: text("primary_color").notNull().default("#2563EB"),
  contact: text("contact"),
  address: text("address"),
  simplifiedMode: boolean("simplified_mode").notNull().default(true),
});

export const insertHospitalSchema = createInsertSchema(hospitalTable).omit({ id: true });
export type InsertHospital = z.infer<typeof insertHospitalSchema>;
export type Hospital = typeof hospitalTable.$inferSelect;
