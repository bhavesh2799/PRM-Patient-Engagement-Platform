import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  leadsTable, activityLogTable, messagesTable,
  segmentsTable, usersTable, templatesTable
} from "@workspace/db";
import { eq, and, gte, lte, ilike, or } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

async function enrichLead(lead: typeof leadsTable.$inferSelect) {
  const owner = lead.ownerUserId
    ? (await db.select().from(usersTable).where(eq(usersTable.id, lead.ownerUserId)))[0]
    : null;
  return { ...lead, ownerName: owner?.name ?? null };
}

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/leads", async (req, res): Promise<void> => {
  let all = await db.select().from(leadsTable).orderBy(leadsTable.createdAt);
  const { channel, status, ownerId, search, optedIn } = req.query as Record<string, string>;
  if (channel) all = all.filter(l => l.sourceChannel === channel);
  if (status) all = all.filter(l => l.status === status);
  if (ownerId) all = all.filter(l => l.ownerUserId === parseInt(ownerId, 10));
  if (search) {
    const s = search.toLowerCase();
    all = all.filter(l =>
      l.firstName.toLowerCase().includes(s) ||
      l.lastName.toLowerCase().includes(s) ||
      l.mobile.includes(s) ||
      (l.uhid ?? "").toLowerCase().includes(s)
    );
  }
  if (optedIn !== undefined) all = all.filter(l => l.optedIn === (optedIn === "true"));
  if (req.query.dateFrom) all = all.filter(l => new Date(l.createdAt) >= new Date(req.query.dateFrom as string));
  if (req.query.dateTo) all = all.filter(l => new Date(l.createdAt) <= new Date(req.query.dateTo as string));

  const enriched = await Promise.all(all.map(enrichLead));
  res.json(enriched);
});

router.post("/leads", async (req, res): Promise<void> => {
  const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    mobile: z.string().min(10),
    uhid: z.string().optional(),
    specialization: z.string().optional(),
    sourceChannel: z.enum(["waba", "web_chat", "form", "csv", "app_booking", "web_booking", "push"]),
    optedIn: z.boolean().default(true),
    sourceListTag: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // de-dupe by mobile
  const existing = await db.select().from(leadsTable).where(eq(leadsTable.mobile, parsed.data.mobile));
  if (existing.length > 0) {
    res.status(409).json({ error: "Lead with this mobile already exists", leadId: existing[0].id });
    return;
  }
  const [lead] = await db.insert(leadsTable).values(parsed.data).returning();
  await db.insert(activityLogTable).values({
    leadId: lead.id,
    type: "created",
    description: `Lead created via ${lead.sourceChannel}`,
    userId: null,
  });
  res.status(201).json(await enrichLead(lead));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const activityLog = await db.select().from(activityLogTable)
    .where(eq(activityLogTable.leadId, id)).orderBy(activityLogTable.createdAt);
  const enrichedLog = await Promise.all(activityLog.map(async (entry) => {
    const user = entry.userId
      ? (await db.select().from(usersTable).where(eq(usersTable.id, entry.userId)))[0]
      : null;
    return { ...entry, userName: user?.name ?? null };
  }));
  res.json({ ...await enrichLead(lead), activityLog: enrichedLog });
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const schema = z.object({
    status: z.enum(["new", "contacted", "in_progress", "fulfilled", "closed"]).optional(),
    ownerUserId: z.number().nullable().optional(),
    specialization: z.string().optional(),
    optedIn: z.boolean().optional(),
    dndListed: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const [lead] = await db.update(leadsTable)
    .set({ ...parsed.data, lastActionAt: new Date() })
    .where(eq(leadsTable.id, id)).returning();

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await db.insert(activityLogTable).values({
      leadId: id,
      type: "status_change",
      description: `Status changed from ${existing.status} to ${parsed.data.status}`,
      userId: null,
    });
  }
  if (parsed.data.ownerUserId !== undefined && parsed.data.ownerUserId !== existing.ownerUserId) {
    const newOwner = parsed.data.ownerUserId
      ? (await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.ownerUserId)))[0]
      : null;
    await db.insert(activityLogTable).values({
      leadId: id,
      type: "assignment",
      description: newOwner ? `Assigned to ${newOwner.name}` : "Unassigned",
      userId: parsed.data.ownerUserId ?? null,
    });
  }
  res.json(await enrichLead(lead));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(activityLogTable).where(eq(activityLogTable.leadId, id));
  await db.delete(messagesTable).where(eq(messagesTable.leadId, id));
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.sendStatus(204);
});

router.get("/leads/:id/messages", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.leadId, id)).orderBy(messagesTable.timestamp);
  res.json(msgs);
});

router.post("/leads/:id/messages", async (req, res): Promise<void> => {
  const leadId = parseId(req.params.id);
  const schema = z.object({
    templateId: z.number().int(),
    channel: z.string(),
    body: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, parsed.data.templateId));
  const body = parsed.data.body ?? template?.body ?? "";
  const [msg] = await db.insert(messagesTable).values({
    leadId,
    direction: "out",
    body,
    channel: parsed.data.channel,
    templateId: parsed.data.templateId,
    status: "sent",
  }).returning();
  await db.update(leadsTable).set({ lastActionAt: new Date(), status: "contacted" }).where(eq(leadsTable.id, leadId));
  await db.insert(activityLogTable).values({
    leadId,
    type: "message_sent",
    description: `Outreach sent via ${parsed.data.channel}: "${body.substring(0, 60)}..."`,
    userId: null,
  });
  res.status(201).json(msg);
});

router.post("/leads/simulate-inbound", async (req, res): Promise<void> => {
  const schema = z.object({
    channel: z.enum(["waba", "web_chat"]),
    mobile: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const mobile = parsed.data.mobile ?? `9${Math.floor(Math.random() * 900000000 + 100000000)}`;
  const firstName = parsed.data.firstName ?? ["Rahul", "Priya", "Amit", "Sunita", "Vikram"][Math.floor(Math.random() * 5)];
  const body = parsed.data.body ?? "Hello, I need an appointment";

  let lead = (await db.select().from(leadsTable).where(eq(leadsTable.mobile, mobile)))[0];
  if (!lead) {
    [lead] = await db.insert(leadsTable).values({
      firstName,
      lastName: "Patient",
      mobile,
      sourceChannel: parsed.data.channel,
      status: "new",
      optedIn: true,
      hasActiveSession: true,
      sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).returning();
    await db.insert(activityLogTable).values({
      leadId: lead.id,
      type: "created",
      description: `Inbound ${parsed.data.channel} message received`,
      userId: null,
    });
  } else {
    await db.update(leadsTable).set({
      hasActiveSession: true,
      sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastActionAt: new Date(),
    }).where(eq(leadsTable.id, lead.id));
  }
  await db.insert(messagesTable).values({
    leadId: lead.id,
    direction: "in",
    body,
    channel: parsed.data.channel,
    status: "received",
  });
  res.status(201).json(await enrichLead(lead));
});

router.post("/leads/csv-upload", async (req, res): Promise<void> => {
  const schema = z.object({
    rows: z.array(z.record(z.string(), z.string())),
    columnMapping: z.record(z.string(), z.string()),
    sourceListTag: z.string(),
    saveAsSegment: z.boolean().optional(),
    segmentName: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { rows, columnMapping, sourceListTag, saveAsSegment, segmentName } = parsed.data;

  const requiredFields = ["firstName", "lastName", "mobile"];
  const mappedFields = Object.values(columnMapping);
  const missingRequired = requiredFields.filter(f => !mappedFields.includes(f));
  if (missingRequired.length > 0) {
    res.status(400).json({ error: `Missing mandatory columns: ${missingRequired.join(", ")}` });
    return;
  }

  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];
  const importedLeadIds: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped: Record<string, string> = {};
    for (const [csvCol, fieldName] of Object.entries(columnMapping)) {
      mapped[fieldName] = row[csvCol] ?? "";
    }
    if (!mapped.firstName || !mapped.lastName || !mapped.mobile) {
      errors.push(`Row ${i + 1}: missing required fields`);
      continue;
    }
    const existing = await db.select().from(leadsTable).where(
      or(
        eq(leadsTable.mobile, mapped.mobile),
        mapped.uhid ? eq(leadsTable.uhid, mapped.uhid) : undefined as never
      )
    );
    if (existing.length > 0) {
      duplicates++;
      importedLeadIds.push(existing[0].id);
      continue;
    }
    const [lead] = await db.insert(leadsTable).values({
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      mobile: mapped.mobile,
      uhid: mapped.uhid || null,
      specialization: mapped.specialization || null,
      sourceChannel: "csv",
      status: "new",
      optedIn: true,
      sourceListTag,
    }).returning();
    importedLeadIds.push(lead.id);
    imported++;
  }

  let segmentId: number | null = null;
  if (saveAsSegment && segmentName && importedLeadIds.length > 0) {
    const [seg] = await db.insert(segmentsTable).values({
      name: segmentName,
      source: "csv",
      count: importedLeadIds.length,
      memberLeadIds: importedLeadIds,
      sourceListTag,
    }).returning();
    segmentId = seg.id;
  }

  res.json({ imported, duplicates, errors, segmentId });
});

router.post("/leads/group-segment", async (req, res): Promise<void> => {
  const schema = z.object({
    leadIds: z.array(z.number().int()),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [seg] = await db.insert(segmentsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    source: "manual",
    count: parsed.data.leadIds.length,
    memberLeadIds: parsed.data.leadIds,
  }).returning();
  res.status(201).json(seg);
});

export default router;
