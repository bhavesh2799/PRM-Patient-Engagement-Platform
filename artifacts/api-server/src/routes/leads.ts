import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  leadsTable, activityLogTable, messagesTable,
  segmentsTable, usersTable, templatesTable,
  walletTable, walletTransactionsTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

async function enrichLead(lead: typeof leadsTable.$inferSelect) {
  const owner = lead.ownerUserId
    ? (await db.select().from(usersTable).where(eq(usersTable.id, lead.ownerUserId)))[0]
    : null;
  // Expire stale sessions
  if (lead.hasActiveSession && lead.sessionExpiresAt && new Date(lead.sessionExpiresAt) < new Date()) {
    await db.update(leadsTable).set({ hasActiveSession: false }).where(eq(leadsTable.id, lead.id));
    lead = { ...lead, hasActiveSession: false };
  }
  return { ...lead, ownerName: owner?.name ?? null };
}

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

// ─── List leads ──────────────────────────────────────────────
router.get("/leads", async (req, res): Promise<void> => {
  let all = await db.select().from(leadsTable).orderBy(leadsTable.lastActionAt);
  const { channel, status, ownerId, search, optedIn, dateFrom, dateTo } = req.query as Record<string, string>;
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
  if (dateFrom) all = all.filter(l => new Date(l.createdAt) >= new Date(dateFrom));
  if (dateTo) all = all.filter(l => new Date(l.createdAt) <= new Date(dateTo));

  const enriched = await Promise.all(all.map(enrichLead));
  res.json(enriched);
});

// ─── Create lead ─────────────────────────────────────────────
router.post("/leads", async (req, res): Promise<void> => {
  const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    mobile: z.string().min(10),
    email: z.string().email().optional(),
    uhid: z.string().optional(),
    specialization: z.string().optional(),
    sourceChannel: z.enum(["waba", "web_chat", "form", "csv", "app_booking", "web_booking", "email", "medicine_order", "lab_test", "web_appointment", "app_appointment"]),
    moduleStage: z.string().optional(),
    transactionContext: z.record(z.unknown()).optional(),
    optedIn: z.boolean().default(true),
    sourceListTag: z.string().optional(),
    userId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(leadsTable).where(eq(leadsTable.mobile, parsed.data.mobile));
  if (existing.length > 0) {
    res.status(409).json({ error: "Lead with this mobile already exists", leadId: existing[0].id });
    return;
  }
  const { userId, ...leadData } = parsed.data;
  const [lead] = await db.insert(leadsTable).values(leadData).returning();
  const actor = userId
    ? (await db.select().from(usersTable).where(eq(usersTable.id, userId)))[0]
    : null;
  await db.insert(activityLogTable).values({
    leadId: lead.id,
    type: "created",
    description: `Lead created via ${lead.sourceChannel}`,
    userId: userId ?? null,
  });
  res.status(201).json(await enrichLead(lead));
});

// ─── Get single lead ─────────────────────────────────────────
router.get("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

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

// ─── Update lead ─────────────────────────────────────────────
router.patch("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const schema = z.object({
    status: z.enum(["new", "contacted", "in_progress", "fulfilled", "closed"]).optional(),
    ownerUserId: z.number().nullable().optional(),
    specialization: z.string().optional(),
    optedIn: z.boolean().optional(),
    dndListed: z.boolean().optional(),
    lastVisitDate: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    userId: z.number().int().nullable().optional(), // actor for logging
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }

  const { userId, ...updateData } = parsed.data;
  const [lead] = await db.update(leadsTable)
    .set({ ...updateData, lastActionAt: new Date() })
    .where(eq(leadsTable.id, id)).returning();

  if (updateData.status && updateData.status !== existing.status) {
    await db.insert(activityLogTable).values({
      leadId: id,
      type: "status_change",
      description: `Status changed from ${existing.status} → ${updateData.status}`,
      userId: userId ?? null,
    });
  }
  if (updateData.ownerUserId !== undefined && updateData.ownerUserId !== existing.ownerUserId) {
    const newOwner = updateData.ownerUserId
      ? (await db.select().from(usersTable).where(eq(usersTable.id, updateData.ownerUserId)))[0]
      : null;
    await db.insert(activityLogTable).values({
      leadId: id,
      type: "assignment",
      description: newOwner ? `Assigned to ${newOwner.name}` : "Unassigned",
      userId: userId ?? null,
    });
  }
  res.json(await enrichLead(lead));
});

// ─── Delete lead ─────────────────────────────────────────────
router.delete("/leads/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(activityLogTable).where(eq(activityLogTable.leadId, id));
  await db.delete(messagesTable).where(eq(messagesTable.leadId, id));
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.sendStatus(204);
});

// ─── Add internal note ────────────────────────────────────────
router.post("/leads/:id/notes", async (req, res): Promise<void> => {
  const leadId = parseId(req.params.id);
  const schema = z.object({
    note: z.string().min(1),
    userId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  const [entry] = await db.insert(activityLogTable).values({
    leadId, type: "note", description: parsed.data.note, userId: parsed.data.userId ?? null,
  }).returning();
  await db.update(leadsTable).set({ lastActionAt: new Date() }).where(eq(leadsTable.id, leadId));
  res.status(201).json(entry);
});

// ─── Get messages ─────────────────────────────────────────────
router.get("/leads/:id/messages", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.leadId, id)).orderBy(messagesTable.timestamp);
  res.json(msgs);
});

// ─── Send message ─────────────────────────────────────────────
router.post("/leads/:id/messages", async (req, res): Promise<void> => {
  const leadId = parseId(req.params.id);

  const schema = z.object({
    messageType: z.enum(["free_text", "template"]).default("template"),
    body: z.string().optional(),
    subject: z.string().optional(),
    templateId: z.number().int().optional(),
    channel: z.string(),
    userId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  // Suppression — always applies
  if (!lead.optedIn) {
    res.status(422).json({ error: "Lead has opted out of communications", reason: "opt_out" });
    return;
  }
  if (lead.dndListed) {
    res.status(422).json({ error: "Lead is on DND list", reason: "dnd" });
    return;
  }

  const { messageType, channel, userId } = parsed.data;

  if (messageType === "free_text") {
    // Session window check
    const sessionOpen =
      lead.hasActiveSession &&
      lead.sessionExpiresAt &&
      new Date(lead.sessionExpiresAt) > new Date();
    if (!sessionOpen) {
      res.status(422).json({
        error: "24h session window is closed. Send an approved template to re-open.",
        reason: "session_expired",
      });
      return;
    }

    const body = parsed.data.body?.trim();
    if (!body) { res.status(400).json({ error: "Message body is required" }); return; }

    const [msg] = await db.insert(messagesTable).values({
      leadId, direction: "out", body, subject: parsed.data.subject ?? null, channel, status: "sent",
    }).returning();

    await db.update(leadsTable).set({
      lastActionAt: new Date(),
      status: lead.status === "new" ? "contacted" : lead.status,
    }).where(eq(leadsTable.id, leadId));

    await db.insert(activityLogTable).values({
      leadId,
      type: "message_sent",
      description: `Free-text sent: "${body.substring(0, 80)}"`,
      userId: userId ?? null,
    });

    // Simulate delivery progression
    setTimeout(async () => {
      await db.update(messagesTable).set({ status: "delivered" }).where(eq(messagesTable.id, msg.id));
    }, 1800);
    setTimeout(async () => {
      await db.update(messagesTable).set({ status: "read" }).where(eq(messagesTable.id, msg.id));
    }, 5000);

    res.status(201).json(msg);
    return;
  }

  // Template send
  if (!parsed.data.templateId) {
    res.status(400).json({ error: "templateId is required for template sends" });
    return;
  }
  const [template] = await db.select().from(templatesTable)
    .where(eq(templatesTable.id, parsed.data.templateId));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  // Channel approval checks
  if (template.channel === "whatsapp" && template.metaStatus !== "APPROVED") {
    res.status(422).json({
      error: "WhatsApp template is not approved by Meta",
      reason: "meta_not_approved",
    });
    return;
  }
  if (template.channel === "sms" && template.dltRegisteredBody) {
    const match = template.body.trim() === template.dltRegisteredBody.trim();
    if (!match) {
      res.status(422).json({
        error: "SMS body doesn't match DLT-registered template",
        reason: "dlt_mismatch",
      });
      return;
    }
  }

  // Wallet debit
  const [wallet] = await db.select().from(walletTable);
  const baseCost = parseFloat(String(template.perMessageCost ?? "0"));
  const platformFee = baseCost * 0.05;
  const gst = (baseCost + platformFee) * 0.18;
  const totalCost = parseFloat((baseCost + platformFee + gst).toFixed(4));

  if (!wallet || parseFloat(String(wallet.balance)) < totalCost) {
    res.status(422).json({ error: "Insufficient wallet balance", reason: "insufficient_balance" });
    return;
  }

  const newBalance = parseFloat(String(wallet.balance)) - totalCost;
  await db.update(walletTable).set({ balance: String(newBalance) }).where(eq(walletTable.id, wallet.id));
  await db.insert(walletTransactionsTable).values({
    type: "debit",
    amount: String(totalCost),
    description: `1:1 template – ${template.name}`,
    reference: `MSG-${Date.now()}`,
  });

  const body = parsed.data.body ?? template.body;
  const [msg] = await db.insert(messagesTable).values({
    leadId, direction: "out", body, channel,
    templateId: parsed.data.templateId, status: "sent",
  }).returning();

  // Template re-opens WABA session
  const sessionUpdate = (template.channel === "whatsapp" || channel === "waba")
    ? { hasActiveSession: true, sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    : {};

  await db.update(leadsTable).set({
    lastActionAt: new Date(),
    status: lead.status === "new" ? "contacted" : lead.status,
    ...sessionUpdate,
  }).where(eq(leadsTable.id, leadId));

  await db.insert(activityLogTable).values({
    leadId,
    type: "template_sent",
    description: `Template "${template.name}" sent via ${channel}`,
    userId: userId ?? null,
  });

  setTimeout(async () => {
    await db.update(messagesTable).set({ status: "delivered" }).where(eq(messagesTable.id, msg.id));
  }, 2000);
  setTimeout(async () => {
    await db.update(messagesTable).set({ status: "read" }).where(eq(messagesTable.id, msg.id));
  }, 6000);

  res.status(201).json(msg);
});

// ─── Simulate inbound message ─────────────────────────────────
router.post("/leads/simulate-inbound", async (req, res): Promise<void> => {
  const schema = z.object({
    leadId: z.number().int().optional(),
    channel: z.enum(["waba", "web_chat"]).default("waba"),
    body: z.string().nullable().optional(),
    mobile: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let lead: typeof leadsTable.$inferSelect | undefined;

  if (parsed.data.leadId) {
    lead = (await db.select().from(leadsTable).where(eq(leadsTable.id, parsed.data.leadId)))[0];
  }
  if (!lead) {
    const mobile = parsed.data.mobile ?? `9${Math.floor(Math.random() * 900000000 + 100000000)}`;
    const firstName = parsed.data.firstName ??
      ["Rahul", "Priya", "Amit", "Sunita", "Vikram"][Math.floor(Math.random() * 5)];
    lead = (await db.select().from(leadsTable).where(eq(leadsTable.mobile, mobile)))[0];
    if (!lead) {
      [lead] = await db.insert(leadsTable).values({
        firstName, lastName: "Patient", mobile,
        sourceChannel: parsed.data.channel,
        status: "new", optedIn: true,
        hasActiveSession: true,
        sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }).returning();
      await db.insert(activityLogTable).values({
        leadId: lead.id,
        type: "created",
        description: `Inbound ${parsed.data.channel} message received`,
        userId: null,
      });
    }
  }

  const body = parsed.data.body ??
    ["Hi, I want to book an appointment", "Is Dr. Krishnan available this week?",
     "Please help me with my test results", "Can I reschedule my appointment?"]
    [Math.floor(Math.random() * 4)];

  await db.update(leadsTable).set({
    hasActiveSession: true,
    sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastActionAt: new Date(),
  }).where(eq(leadsTable.id, lead.id));

  await db.insert(messagesTable).values({
    leadId: lead.id,
    direction: "in",
    body,
    channel: parsed.data.channel,
    status: "received",
  });

  res.status(201).json(await enrichLead(lead));
});

// ─── CSV upload ───────────────────────────────────────────────
router.post("/leads/csv-upload", async (req, res): Promise<void> => {
  const schema = z.object({
    rows: z.array(z.record(z.string(), z.string())),
    columnMapping: z.record(z.string(), z.string()),
    sourceListTag: z.string(),
    saveAsSegment: z.boolean().optional(),
    segmentName: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { rows, columnMapping, sourceListTag, saveAsSegment, segmentName } = parsed.data;
  const requiredFields = ["firstName", "lastName", "mobile"];
  const mappedFields = Object.values(columnMapping);
  const missingRequired = requiredFields.filter(f => !mappedFields.includes(f));
  if (missingRequired.length > 0) {
    res.status(400).json({ error: `Missing mandatory columns: ${missingRequired.join(", ")}` });
    return;
  }

  let imported = 0, duplicates = 0;
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
      firstName: mapped.firstName, lastName: mapped.lastName, mobile: mapped.mobile,
      uhid: mapped.uhid || null, specialization: mapped.specialization || null,
      sourceChannel: "csv", status: "new", optedIn: true, sourceListTag,
    }).returning();
    importedLeadIds.push(lead.id);
    imported++;
  }

  let segmentId: number | null = null;
  if (saveAsSegment && segmentName && importedLeadIds.length > 0) {
    const [seg] = await db.insert(segmentsTable).values({
      name: segmentName, source: "csv",
      count: importedLeadIds.length, memberLeadIds: importedLeadIds,
    }).returning();
    segmentId = seg.id;
  }
  res.json({ imported, duplicates, errors, segmentId });
});

// ─── Group leads into segment ─────────────────────────────────
router.post("/leads/group-segment", async (req, res): Promise<void> => {
  const schema = z.object({
    leadIds: z.array(z.number().int()),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [seg] = await db.insert(segmentsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    source: "manual",
    count: parsed.data.leadIds.length,
    memberLeadIds: parsed.data.leadIds,
  }).returning();
  res.status(201).json(seg);
});

// ─── Simulate inbound email ────────────────────────────────────
router.post("/leads/simulate-email", async (req, res): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    mobile: z.string().nullable().optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, subject, body } = parsed.data;
  let lead: typeof leadsTable.$inferSelect | undefined;

  // Try to find existing lead by email
  const allLeads = await db.select().from(leadsTable);
  lead = allLeads.find(l => l.email === email);

  if (!lead) {
    const mobile = parsed.data.mobile ?? `9${Math.floor(Math.random() * 900000000 + 100000000)}`;
    const firstName = parsed.data.firstName ?? email.split("@")[0].split(".")[0] ?? "Patient";
    [lead] = await db.insert(leadsTable).values({
      firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
      lastName: parsed.data.lastName ?? "Patient",
      mobile,
      email,
      sourceChannel: "email",
      status: "new",
      optedIn: true,
    }).returning();
    await db.insert(activityLogTable).values({
      leadId: lead.id,
      type: "created",
      description: "Lead created via inbound email",
      userId: null,
    });
  }

  await db.insert(messagesTable).values({
    leadId: lead.id,
    direction: "in",
    body,
    subject,
    channel: "email",
    status: "received",
  });

  await db.update(leadsTable).set({ lastActionAt: new Date() }).where(eq(leadsTable.id, lead.id));

  res.status(201).json(await enrichLead(lead));
});

// ─── Advance module stage ──────────────────────────────────────
router.patch("/leads/:id/stage", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const schema = z.object({
    stage: z.string().min(1),
    userId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }

  const prevStage = existing.moduleStage ?? "—";
  const newStage = parsed.data.stage;

  // Auto-fulfil on terminal stages
  const terminalStages = ["delivered", "result_ready", "visited"];
  const newStatus = terminalStages.includes(newStage) ? "fulfilled" : existing.status;

  const [lead] = await db.update(leadsTable)
    .set({ moduleStage: newStage, status: newStatus, lastActionAt: new Date() })
    .where(eq(leadsTable.id, id)).returning();

  await db.insert(activityLogTable).values({
    leadId: id,
    type: "stage_change",
    description: `Stage advanced: ${prevStage} → ${newStage}`,
    userId: parsed.data.userId ?? null,
  });

  if (newStatus !== existing.status) {
    await db.insert(activityLogTable).values({
      leadId: id,
      type: "status_change",
      description: `Status auto-updated: ${existing.status} → ${newStatus} (terminal stage reached)`,
      userId: parsed.data.userId ?? null,
    });
  }

  res.json(await enrichLead(lead));
});

// ─── Log a call ────────────────────────────────────────────────
router.post("/leads/:id/calls", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const schema = z.object({
    outcome: z.enum(["connected", "no_answer", "wrong_number", "voicemail"]),
    durationSeconds: z.number().int().nullable().optional(),
    note: z.string().nullable().optional(),
    userId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }

  const { outcome, durationSeconds, note, userId } = parsed.data;
  const durStr = durationSeconds ? ` (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s)` : "";
  const noteStr = note ? ` — "${note}"` : "";
  const description = `Call ${outcome}${durStr}${noteStr}`;

  const [entry] = await db.insert(activityLogTable).values({
    leadId: id,
    type: "call",
    description,
    userId: userId ?? null,
  }).returning();

  // Advance status from new → contacted on any call attempt
  if (existing.status === "new") {
    await db.update(leadsTable)
      .set({ status: "contacted", lastActionAt: new Date() })
      .where(eq(leadsTable.id, id));
    await db.insert(activityLogTable).values({
      leadId: id,
      type: "status_change",
      description: "Status changed from new → contacted (call logged)",
      userId: userId ?? null,
    });
  } else {
    await db.update(leadsTable)
      .set({ lastActionAt: new Date() })
      .where(eq(leadsTable.id, id));
  }

  res.status(201).json(entry);
});

export default router;
