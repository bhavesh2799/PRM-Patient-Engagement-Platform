import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { specializationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/specializations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(specializationsTable).orderBy(specializationsTable.name);
  res.json(rows);
});

router.post("/specializations", async (req, res): Promise<void> => {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [spec] = await db.insert(specializationsTable).values(parsed.data).returning();
  res.status(201).json(spec);
});

router.delete("/specializations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(specializationsTable).where(eq(specializationsTable.id, id));
  res.sendStatus(204);
});

export default router;
