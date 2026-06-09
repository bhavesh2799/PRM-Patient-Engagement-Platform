import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sendRulesTable } from "@workspace/db";
import { gt } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.get("/send-rules", async (_req, res): Promise<void> => {
  const [rules] = await db.select().from(sendRulesTable);
  res.json(rules ?? { sendWindowStart: "09:00", sendWindowEnd: "21:00", frequencyCap: 3 });
});

router.patch("/send-rules", async (req, res): Promise<void> => {
  const schema = z.object({
    sendWindowStart: z.string().optional(),
    sendWindowEnd: z.string().optional(),
    frequencyCap: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(sendRulesTable);
  if (existing) {
    const [updated] = await db.update(sendRulesTable).set(parsed.data).where(gt(sendRulesTable.id, 0)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(sendRulesTable).values({
      sendWindowStart: parsed.data.sendWindowStart ?? "09:00",
      sendWindowEnd: parsed.data.sendWindowEnd ?? "21:00",
      frequencyCap: parsed.data.frequencyCap ?? 3,
    }).returning();
    res.json(created);
  }
});

export default router;
