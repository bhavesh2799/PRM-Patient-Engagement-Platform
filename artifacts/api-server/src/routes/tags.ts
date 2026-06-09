import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tagsTable, quickRepliesTable, uploadHistoryTable, leadsTable, activityLogTable, usersTable } from "@workspace/db";
import { eq, gt } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

// ─── Tags ─────────────────────────────────────────────────────

router.get("/tags", async (_req, res): Promise<void> => {
  const tags = await db.select().from(tagsTable).orderBy(tagsTable.createdAt);
  res.json(tags);
});

router.post("/tags", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    color: z.string().default("#6366f1"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [tag] = await db.insert(tagsTable).values(parsed.data).returning();
  res.status(201).json(tag);
});

router.patch("/tags/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const schema = z.object({
    name: z.string().optional(),
    color: z.string().optional(),
    archived: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [tag] = await db.update(tagsTable).set(parsed.data).where(eq(tagsTable.id, id)).returning();
  if (!tag) { res.status(404).json({ error: "Tag not found" }); return; }
  res.json(tag);
});

router.delete("/tags/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(tagsTable).where(eq(tagsTable.id, id));
  res.sendStatus(204);
});

// ─── Quick Replies ─────────────────────────────────────────────

router.get("/settings/quick-replies", async (_req, res): Promise<void> => {
  const replies = await db.select().from(quickRepliesTable).orderBy(quickRepliesTable.sortOrder);
  res.json(replies);
});

router.post("/settings/quick-replies", async (req, res): Promise<void> => {
  const schema = z.object({ text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [reply] = await db.insert(quickRepliesTable).values({ text: parsed.data.text }).returning();
  res.status(201).json(reply);
});

router.patch("/settings/quick-replies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const schema = z.object({ text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [reply] = await db.update(quickRepliesTable).set({ text: parsed.data.text })
    .where(eq(quickRepliesTable.id, id)).returning();
  if (!reply) { res.status(404).json({ error: "Quick reply not found" }); return; }
  res.json(reply);
});

router.delete("/settings/quick-replies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(quickRepliesTable).where(eq(quickRepliesTable.id, id));
  res.sendStatus(204);
});

// ─── Upload History ─────────────────────────────────────────────

router.get("/leads/upload-history", async (_req, res): Promise<void> => {
  const history = await db.select().from(uploadHistoryTable)
    .orderBy(uploadHistoryTable.createdAt);
  res.json(history.reverse().slice(0, 20));
});

router.post("/leads/upload-history", async (req, res): Promise<void> => {
  const schema = z.object({
    sourceName: z.string().min(1),
    fileName: z.string(),
    totalRows: z.number().int(),
    imported: z.number().int(),
    merged: z.number().int(),
    rejected: z.number().int(),
    segmentId: z.number().int().nullable().optional(),
    segmentName: z.string().nullable().optional(),
    rejectedRows: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [entry] = await db.insert(uploadHistoryTable).values(parsed.data).returning();
  res.status(201).json(entry);
});

router.delete("/leads/upload-history/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const [entry] = await db.select().from(uploadHistoryTable).where(eq(uploadHistoryTable.id, id));
  if (!entry) { res.status(404).json({ error: "Upload not found" }); return; }
  // Remove sourceListTag from leads matching this batch name
  await db.update(leadsTable)
    .set({ sourceListTag: null })
    .where(eq(leadsTable.sourceListTag, entry.sourceName));
  await db.delete(uploadHistoryTable).where(eq(uploadHistoryTable.id, id));
  res.sendStatus(204);
});

// ─── Source list names ──────────────────────────────────────────

router.get("/leads/source-lists", async (_req, res): Promise<void> => {
  const all = await db.select({ sourceListTag: leadsTable.sourceListTag }).from(leadsTable);
  const unique = [...new Set(all.map(l => l.sourceListTag).filter(Boolean))] as string[];
  res.json(unique);
});

// ─── Bulk actions ────────────────────────────────────────────────

router.patch("/leads/bulk", async (req, res): Promise<void> => {
  const schema = z.object({
    leadIds: z.array(z.number().int()).min(1),
    status: z.enum(["new", "contacted", "in_progress", "fulfilled", "closed"]).optional(),
    ownerUserId: z.number().int().nullable().optional(),
    addTags: z.array(z.string()).optional(),
    removeTags: z.array(z.string()).optional(),
    userId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { leadIds, status, ownerUserId, addTags, removeTags, userId } = parsed.data;

  const actor = userId
    ? (await db.select().from(usersTable).where(eq(usersTable.id, userId)))[0]
    : null;

  for (const id of leadIds) {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
    if (!lead) continue;

    const updates: Record<string, unknown> = { lastActionAt: new Date() };

    if (status && status !== lead.status) {
      updates.status = status;
      await db.insert(activityLogTable).values({
        leadId: id, type: "status_change",
        description: `Bulk status change: ${lead.status} → ${status}`,
        userId: userId ?? null,
      });
    }
    if (ownerUserId !== undefined && ownerUserId !== lead.ownerUserId) {
      updates.ownerUserId = ownerUserId;
      const newOwner = ownerUserId
        ? (await db.select().from(usersTable).where(eq(usersTable.id, ownerUserId)))[0]
        : null;
      await db.insert(activityLogTable).values({
        leadId: id, type: "assignment",
        description: newOwner
          ? `Bulk assigned to ${newOwner.name}${actor ? ` by ${actor.name}` : ""}`
          : "Bulk unassigned",
        userId: userId ?? null,
      });
    }
    if (addTags && addTags.length > 0) {
      const currentTags = (lead.tags as string[]) ?? [];
      const newTags = [...new Set([...currentTags, ...addTags])];
      updates.tags = newTags;
      await db.insert(activityLogTable).values({
        leadId: id, type: "tag_added",
        description: `Tags added: ${addTags.join(", ")}`,
        userId: userId ?? null,
      });
    }
    if (removeTags && removeTags.length > 0) {
      const currentTags = (lead.tags as string[]) ?? [];
      updates.tags = currentTags.filter(t => !removeTags.includes(t));
    }

    if (Object.keys(updates).length > 1) {
      await db.update(leadsTable).set(updates).where(eq(leadsTable.id, id));
    }
  }

  res.json({ updated: leadIds.length });
});

export default router;
