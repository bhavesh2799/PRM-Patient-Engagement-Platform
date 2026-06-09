import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  specialization: text("specialization").notNull(),
  sourceChannel: text("source_channel").notNull(),
  status: text("status").notNull().default("booked"),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
