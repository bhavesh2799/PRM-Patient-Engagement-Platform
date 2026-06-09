import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { appointmentsTable, leadsTable, doctorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

async function enrichAppointment(a: typeof appointmentsTable.$inferSelect) {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, a.leadId));
  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, a.doctorId));
  return {
    ...a,
    leadName: lead ? `${lead.firstName} ${lead.lastName}` : null,
    leadMobile: lead?.mobile ?? null,
    doctorName: doctor?.name ?? null,
    datetime: a.datetime.toISOString(),
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/appointments", async (req, res): Promise<void> => {
  let all = await db.select().from(appointmentsTable).orderBy(appointmentsTable.datetime);
  const { status, channel, doctorId } = req.query as Record<string, string>;
  if (status) all = all.filter(a => a.status === status);
  if (channel) all = all.filter(a => a.sourceChannel === channel);
  if (doctorId) all = all.filter(a => a.doctorId === parseInt(doctorId, 10));
  if (req.query.dateFrom) all = all.filter(a => new Date(a.datetime) >= new Date(req.query.dateFrom as string));
  if (req.query.dateTo) all = all.filter(a => new Date(a.datetime) <= new Date(req.query.dateTo as string));
  const enriched = await Promise.all(all.map(enrichAppointment));
  res.json(enriched);
});

router.post("/appointments", async (req, res): Promise<void> => {
  const schema = z.object({
    leadId: z.number().int(),
    doctorId: z.number().int(),
    specialization: z.string().min(1),
    sourceChannel: z.enum(["app_booking", "web_booking"]),
    datetime: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [appt] = await db.insert(appointmentsTable).values({
    ...parsed.data,
    datetime: new Date(parsed.data.datetime),
  }).returning();
  res.status(201).json(await enrichAppointment(appt));
});

router.get("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.json(await enrichAppointment(appt));
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const schema = z.object({
    status: z.enum(["booked", "confirmed", "completed", "cancelled"]).optional(),
    datetime: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.datetime) updateData.datetime = new Date(parsed.data.datetime);
  const [appt] = await db.update(appointmentsTable).set(updateData).where(eq(appointmentsTable.id, id)).returning();
  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.json(await enrichAppointment(appt));
});

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
  res.sendStatus(204);
});

export default router;
