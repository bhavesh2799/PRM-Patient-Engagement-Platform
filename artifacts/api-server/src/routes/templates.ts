import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { templatesTable, templateRequestsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/templates", async (req, res): Promise<void> => {
  let all = await db.select().from(templatesTable).orderBy(templatesTable.name);
  const { channel, goal, language, status } = req.query as Record<string, string>;
  if (channel) all = all.filter(t => t.channel === channel);
  if (goal) all = all.filter(t => t.goal === goal);
  if (language) all = all.filter(t => t.language === language);
  if (status) all = all.filter(t => t.status === status);
  res.json(all.map(t => ({ ...t, perMessageCost: parseFloat(t.perMessageCost ?? "0") })));
});

router.get("/templates/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [t] = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!t) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json({ ...t, perMessageCost: parseFloat(t.perMessageCost ?? "0") });
});

router.patch("/templates/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const schema = z.object({
    status: z.enum(["approved", "pending", "rejected"]).optional(),
    dltRegisteredBody: z.string().optional(),
    metaStatus: z.string().optional(),
    qualityRating: z.string().optional(),
    senderId: z.string().optional(),
    wabaContact: z.string().optional(),
    scope: z.enum(["global", "hospital"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [t] = await db.update(templatesTable).set(parsed.data).where(eq(templatesTable.id, id)).returning();
  if (!t) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json({ ...t, perMessageCost: parseFloat(t.perMessageCost ?? "0") });
});

// Template Requests
router.get("/template-requests", async (_req, res): Promise<void> => {
  const all = await db.select().from(templateRequestsTable).orderBy(templateRequestsTable.createdAt);
  const enriched = await Promise.all(all.map(async (tr) => {
    const userId = parseInt(tr.createdBy, 10);
    const user = !isNaN(userId)
      ? (await db.select().from(usersTable).where(eq(usersTable.id, userId)))[0]
      : null;
    return { ...tr, createdByName: user?.name ?? tr.createdBy, createdAt: tr.createdAt.toISOString() };
  }));
  res.json(enriched);
});

router.post("/template-requests", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    channel: z.enum(["sms", "whatsapp", "push"]),
    message: z.string().min(1),
    media: z.string().optional(),
    goal: z.string().min(1),
    variables: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tr] = await db.insert(templateRequestsTable).values({
    ...parsed.data,
    createdBy: "1",
    approvalStage: "ap_marketing",
  }).returning();
  res.status(201).json({ ...tr, createdByName: "Exec User", createdAt: tr.createdAt.toISOString() });
});

router.patch("/template-requests/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const schema = z.object({
    approvalStage: z.enum(["ap_marketing", "channel_compliance", "live", "rejected"]).optional(),
    rejectionReason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tr] = await db.update(templateRequestsTable).set(parsed.data).where(eq(templateRequestsTable.id, id)).returning();
  if (!tr) {
    res.status(404).json({ error: "Template request not found" });
    return;
  }

  // If approved to live, create the template
  if (parsed.data.approvalStage === "live") {
    await db.insert(templatesTable).values({
      name: tr.name,
      channel: tr.channel,
      goal: tr.goal,
      language: "English",
      body: tr.message,
      media: tr.media,
      status: "approved",
      scope: "hospital",
      perMessageCost: tr.channel === "whatsapp" ? "0.35" : tr.channel === "sms" ? "0.08" : "0.03",
    });
  }

  res.json({ ...tr, createdAt: tr.createdAt.toISOString() });
});

export default router;
