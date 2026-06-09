import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { doctorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const slotSchema = z.object({
  day: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

router.get("/doctors", async (req, res): Promise<void> => {
  const doctors = await db.select().from(doctorsTable).orderBy(doctorsTable.name);
  let result = doctors;
  if (req.query.specialization) {
    result = result.filter(d => d.specialization === req.query.specialization);
  }
  if (req.query.active !== undefined) {
    const active = req.query.active === "true";
    result = result.filter(d => d.active === active);
  }
  res.json(result);
});

router.post("/doctors", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    specialization: z.string().min(1),
    qualifications: z.string().optional(),
    experience: z.number().int().optional(),
    email: z.string().optional(),
    mobile: z.string().optional(),
    bio: z.string().optional(),
    registrationNumber: z.string().optional(),
    slots: z.array(slotSchema).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [doctor] = await db.insert(doctorsTable).values({
    ...parsed.data,
    slots: parsed.data.slots ?? [],
  }).returning();
  res.status(201).json(doctor);
});

router.get("/doctors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, id));
  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }
  res.json(doctor);
});

router.patch("/doctors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const schema = z.object({
    name: z.string().optional(),
    specialization: z.string().optional(),
    qualifications: z.string().optional(),
    experience: z.number().int().optional(),
    active: z.boolean().optional(),
    email: z.string().optional(),
    mobile: z.string().optional(),
    bio: z.string().optional(),
    registrationNumber: z.string().optional(),
    slots: z.array(slotSchema).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [doctor] = await db.update(doctorsTable).set(parsed.data).where(eq(doctorsTable.id, id)).returning();
  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }
  res.json(doctor);
});

router.delete("/doctors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(doctorsTable).where(eq(doctorsTable.id, id));
  res.sendStatus(204);
});

export default router;
