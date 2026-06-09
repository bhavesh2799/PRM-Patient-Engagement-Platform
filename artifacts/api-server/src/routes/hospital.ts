import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hospitalTable } from "@workspace/db";
import { gt } from "drizzle-orm";
import { z } from "zod";
import { runSeed } from "../lib/seed.js";

const router: IRouter = Router();

router.get("/hospital", async (_req, res): Promise<void> => {
  const rows = await db.select().from(hospitalTable);
  if (!rows[0]) {
    res.status(404).json({ error: "Hospital not found" });
    return;
  }
  res.json(rows[0]);
});

router.patch("/hospital", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().optional(),
    logo: z.string().optional(),
    primaryColor: z.string().optional(),
    contact: z.string().optional(),
    address: z.string().optional(),
    simplifiedMode: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [hospital] = await db
    .update(hospitalTable)
    .set(parsed.data)
    .where(gt(hospitalTable.id, 0))
    .returning();
  if (!hospital) {
    res.status(404).json({ error: "Hospital not found" });
    return;
  }
  res.json(hospital);
});

router.post("/hospital/reset", async (_req, res): Promise<void> => {
  await runSeed(true);
  res.json({ message: "Demo data reset successfully" });
});

export default router;
