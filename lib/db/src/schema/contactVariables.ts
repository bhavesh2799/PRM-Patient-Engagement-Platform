import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactVariablesTable = pgTable("contact_variables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  mandatory: boolean("mandatory").notNull().default(false),
  system: boolean("system").notNull().default(false),
});

export const insertContactVariableSchema = createInsertSchema(contactVariablesTable).omit({ id: true });
export type InsertContactVariable = z.infer<typeof insertContactVariableSchema>;
export type ContactVariable = typeof contactVariablesTable.$inferSelect;
