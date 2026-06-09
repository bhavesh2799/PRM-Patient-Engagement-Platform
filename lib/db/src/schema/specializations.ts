import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const specializationsTable = pgTable("specializations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const insertSpecializationSchema = createInsertSchema(specializationsTable).omit({ id: true });
export type InsertSpecialization = z.infer<typeof insertSpecializationSchema>;
export type Specialization = typeof specializationsTable.$inferSelect;
