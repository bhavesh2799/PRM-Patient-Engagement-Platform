import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactVariablesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/contact-variables", async (_req, res): Promise<void> => {
  const rows = await db.select().from(contactVariablesTable).orderBy(contactVariablesTable.id);
  res.json(rows);
});

router.post("/contact-variables", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().default(""),
    mandatory: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(contactVariablesTable).values({ ...parsed.data, system: false }).returning();
  res.status(201).json(row);
});

router.patch("/contact-variables/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const schema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    mandatory: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(contactVariablesTable).set(parsed.data).where(eq(contactVariablesTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/contact-variables/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db.select().from(contactVariablesTable).where(eq(contactVariablesTable.id, id));
  if (row?.system) {
    res.status(400).json({ error: "Cannot delete system variables" });
    return;
  }
  await db.delete(contactVariablesTable).where(eq(contactVariablesTable.id, id));
  res.sendStatus(204);
});

export default router;
