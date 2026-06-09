import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/notifications", async (_req, res): Promise<void> => {
  const all = await db.select().from(notificationsTable).orderBy(notificationsTable.id);
  res.json(all.map(n => ({ ...n, read: n.read === "true" })).reverse());
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [n] = await db.update(notificationsTable).set({ read: "true" }).where(eq(notificationsTable.id, id)).returning();
  if (!n) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json({ ...n, read: true });
});

export default router;
