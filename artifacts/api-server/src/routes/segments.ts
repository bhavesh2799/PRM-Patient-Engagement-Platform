import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { segmentsTable, leadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/segments", async (_req, res): Promise<void> => {
  const rows = await db.select().from(segmentsTable).orderBy(segmentsTable.createdAt);
  res.json(rows.map(s => ({
    ...s,
    lastRefreshAt: s.lastRefreshAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/segments", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    source: z.enum(["affordplan", "his", "csv", "manual"]).default("manual"),
    conditionTree: z.string().optional(),
    memberLeadIds: z.array(z.number().int()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const memberLeadIds = parsed.data.memberLeadIds ?? [];
  let count = memberLeadIds.length;
  if (count === 0 && parsed.data.source === "affordplan") {
    // simulate count from condition tree
    const allLeads = await db.select().from(leadsTable);
    count = Math.min(allLeads.length, Math.floor(Math.random() * 50) + 10);
  }
  const [seg] = await db.insert(segmentsTable).values({
    ...parsed.data,
    memberLeadIds,
    count,
  }).returning();
  res.status(201).json({ ...seg, lastRefreshAt: seg.lastRefreshAt.toISOString(), createdAt: seg.createdAt.toISOString() });
});

router.get("/segments/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, id));
  if (!seg) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  res.json({ ...seg, lastRefreshAt: seg.lastRefreshAt.toISOString(), createdAt: seg.createdAt.toISOString() });
});

router.delete("/segments/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(segmentsTable).where(eq(segmentsTable.id, id));
  res.sendStatus(204);
});

router.post("/segments/:id/refresh", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, id));
  if (!seg) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  // Recompute count
  let count = (seg.memberLeadIds as number[]).length;
  if (seg.source === "affordplan" || seg.source === "his") {
    const allLeads = await db.select().from(leadsTable);
    count = Math.min(allLeads.length, count + Math.floor(Math.random() * 5));
  }
  const [updated] = await db.update(segmentsTable)
    .set({ count, lastRefreshAt: new Date() })
    .where(eq(segmentsTable.id, id)).returning();
  res.json({ ...updated, lastRefreshAt: updated.lastRefreshAt.toISOString(), createdAt: updated.createdAt.toISOString() });
});

router.post("/segments/:id/export", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, id));
  if (!seg) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  res.json({ message: `Export of segment "${seg.name}" initiated. CSV will be ready shortly.` });
});

export default router;
