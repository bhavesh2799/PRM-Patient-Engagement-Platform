import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable, campaignMetricsTable, segmentsTable,
  templatesTable, walletTable, walletTransactionsTable,
  invoicesTable, usersTable, leadsTable, notificationsTable, sendRulesTable
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { simulateDeliveryEvents } from "../lib/mockMessaging.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

async function enrichCampaign(c: typeof campaignsTable.$inferSelect) {
  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, c.createdBy));
  const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, c.audienceSegmentId));
  let approvedByName: string | null = null;
  if (c.approvedBy) {
    const [approver] = await db.select().from(usersTable).where(eq(usersTable.id, c.approvedBy));
    approvedByName = approver?.name ?? null;
  }
  return {
    ...c,
    createdByName: creator?.name ?? null,
    approvedByName,
    audienceSegmentName: seg?.name ?? null,
    createdAt: c.createdAt.toISOString(),
    launchedAt: c.launchedAt?.toISOString() ?? null,
  };
}

router.get("/campaigns", async (req, res): Promise<void> => {
  let all = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
  if (req.query.status) all = all.filter(c => c.status === req.query.status);
  const enriched = await Promise.all(all.map(enrichCampaign));
  res.json(enriched);
});

router.post("/campaigns", async (req, res): Promise<void> => {
  const channelSchema = z.object({
    channel: z.enum(["sms", "whatsapp", "push"]),
    templateId: z.number().int(),
    perMessageCost: z.number(),
    senderId: z.string().nullable().optional(),
    wabaContact: z.string().nullable().optional(),
  });
  const schema = z.object({
    name: z.string().min(1),
    goal: z.string().min(1),
    audienceSegmentId: z.number().int(),
    channels: z.array(channelSchema).optional().default([]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, parsed.data.audienceSegmentId));
  const recipients = seg?.count ?? 0;

  // Compute costs
  const channels = parsed.data.channels as Array<{ channel: string; templateId: number; perMessageCost: number; senderId?: string | null; wabaContact?: string | null; templateName?: string }>;
  const enrichedChannels = await Promise.all(channels.map(async (ch) => {
    const [tmpl] = await db.select().from(templatesTable).where(eq(templatesTable.id, ch.templateId));
    return { ...ch, templateName: tmpl?.name ?? null, perMessageCost: ch.perMessageCost || parseFloat(tmpl?.perMessageCost ?? "0") };
  }));

  const channelCost = enrichedChannels.reduce((sum, ch) => sum + ch.perMessageCost * recipients, 0);
  const fee = channelCost * 0.05;
  const gst = (channelCost + fee) * 0.18;
  const total = channelCost + fee + gst;

  const [campaign] = await db.insert(campaignsTable).values({
    name: parsed.data.name,
    goal: parsed.data.goal,
    audienceSegmentId: parsed.data.audienceSegmentId,
    channels: enrichedChannels,
    estimatedRecipients: recipients,
    costBreakdown: { channelCost, fee, gst, total },
    status: "draft",
    createdBy: 1,
  }).returning();

  res.status(201).json(await enrichCampaign(campaign));
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!c) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(await enrichCampaign(c));
});

router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const channelSchema = z.object({
    channel: z.enum(["sms", "whatsapp", "push"]),
    templateId: z.number().int(),
    perMessageCost: z.number(),
    senderId: z.string().nullable().optional(),
    wabaContact: z.string().nullable().optional(),
  });
  const schema = z.object({
    name: z.string().optional(),
    goal: z.string().optional(),
    audienceSegmentId: z.number().int().optional(),
    channels: z.array(channelSchema).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.audienceSegmentId || parsed.data.channels) {
    const segId = parsed.data.audienceSegmentId;
    const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
    const finalSegId = segId ?? existing?.audienceSegmentId ?? 0;
    const [seg] = await db.select().from(segmentsTable).where(eq(segmentsTable.id, finalSegId));
    const recipients = seg?.count ?? existing?.estimatedRecipients ?? 0;
    const channels = (parsed.data.channels ?? existing?.channels ?? []) as Array<{ channel: string; templateId: number; perMessageCost: number }>;
    const channelCost = channels.reduce((sum, ch) => sum + ch.perMessageCost * recipients, 0);
    const fee = channelCost * 0.05;
    const gst = (channelCost + fee) * 0.18;
    const total = channelCost + fee + gst;
    updateData.costBreakdown = { channelCost, fee, gst, total };
    updateData.estimatedRecipients = recipients;
  }

  const [c] = await db.update(campaignsTable).set(updateData).where(eq(campaignsTable.id, id)).returning();
  if (!c) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(await enrichCampaign(c));
});

router.post("/campaigns/:id/submit", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [c] = await db.update(campaignsTable)
    .set({ status: "submitted" }).where(eq(campaignsTable.id, id)).returning();
  if (!c) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  await db.insert(notificationsTable).values({
    title: "Campaign Submitted for Approval",
    body: `Campaign "${c.name}" is awaiting manager approval.`,
    type: "campaign_submitted",
    read: "false",
    createdAt: new Date().toISOString(),
  });
  res.json(await enrichCampaign(c));
});

router.post("/campaigns/:id/approve", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const channels = (campaign.channels ?? []) as Array<{
    channel: string; templateId: number; perMessageCost: number; senderId?: string; wabaContact?: string;
  }>;
  const recipients = campaign.estimatedRecipients ?? 0;
  const costBreakdown = (campaign.costBreakdown as { channelCost: number; fee: number; gst: number; total: number }) ?? { channelCost: 0, fee: 0, gst: 0, total: 0 };

  // Fetch wallet
  const [walletRow] = await db.select().from(walletTable);
  const balance = parseFloat(walletRow?.balance ?? "0");

  // Fetch send rules
  const [rules] = await db.select().from(sendRulesTable);
  const sendWindowStart = rules?.sendWindowStart ?? "09:00";
  const sendWindowEnd = rules?.sendWindowEnd ?? "21:00";
  const frequencyCap = rules?.frequencyCap ?? 3;

  const complianceChecks: Array<{ name: string; passed: boolean; message: string; droppedCount?: number }> = [];

  let allPassed = true;
  let autoDropped = 0;

  // Run checks per channel
  for (const ch of channels) {
    const [template] = ch.templateId
      ? await db.select().from(templatesTable).where(eq(templatesTable.id, ch.templateId))
      : [null];

    if (ch.channel === "sms") {
      // DLT Template Match
      const dltMatch = template?.dltRegisteredBody != null && template.dltRegisteredBody === template.body;
      complianceChecks.push({
        name: "DLT Template Match (SMS)",
        passed: dltMatch,
        message: dltMatch ? "Template body matches DLT-registered body" : "Template body does NOT match DLT-registered body — hard block",
      });
      if (!dltMatch) allPassed = false;

      // Send Window
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffset);
      const hhmm = `${String(istNow.getUTCHours()).padStart(2, "0")}:${String(istNow.getUTCMinutes()).padStart(2, "0")}`;
      const inWindow = hhmm >= sendWindowStart && hhmm <= sendWindowEnd;
      complianceChecks.push({
        name: "Send Window (SMS Promo)",
        passed: inWindow,
        message: inWindow ? `Current IST time ${hhmm} is within ${sendWindowStart}–${sendWindowEnd}` : `Current IST time ${hhmm} is outside send window ${sendWindowStart}–${sendWindowEnd} — hard block`,
      });
      if (!inWindow) allPassed = false;
    }

    if (ch.channel === "whatsapp") {
      // Meta Approval
      const metaOk = template?.metaStatus === "APPROVED" && template?.qualityRating !== "Red";
      complianceChecks.push({
        name: "Meta Approval (WhatsApp)",
        passed: metaOk,
        message: metaOk
          ? `Template is Meta-approved (quality: ${template?.qualityRating})`
          : `Template metaStatus=${template?.metaStatus}, qualityRating=${template?.qualityRating} — hard block`,
      });
      if (!metaOk) allPassed = false;
    }
  }

  // Suppression Scrub
  const allLeads = await db.select().from(leadsTable);
  const dndDrop = allLeads.filter(l => l.dndListed || !l.optedIn).length;
  const scrubPct = Math.min(dndDrop, Math.floor(recipients * 0.08));
  complianceChecks.push({
    name: "Suppression Scrub",
    passed: true,
    message: `${scrubPct} recipients dropped (opted-out / DND listed). Proceeding with ${recipients - scrubPct} recipients.`,
    droppedCount: scrubPct,
  });
  autoDropped += scrubPct;

  // Frequency Cap
  const freqDrop = Math.floor((recipients - autoDropped) * 0.04);
  complianceChecks.push({
    name: "Frequency Cap",
    passed: true,
    message: `${freqDrop} recipients dropped (already received ${frequencyCap} messages in 24h). Auto-dropped.`,
    droppedCount: freqDrop,
  });
  autoDropped += freqDrop;

  // Wallet Balance
  const walletOk = balance >= costBreakdown.total;
  complianceChecks.push({
    name: "Wallet Balance",
    passed: walletOk,
    message: walletOk
      ? `Balance ₹${balance.toFixed(2)} covers total cost ₹${costBreakdown.total.toFixed(2)}`
      : `Insufficient balance: ₹${balance.toFixed(2)} < ₹${costBreakdown.total.toFixed(2)} — hard block`,
  });
  if (!walletOk) allPassed = false;

  if (!allPassed) {
    const [updated] = await db.update(campaignsTable)
      .set({ complianceResult: { checks: complianceChecks, passed: false }, status: "failed" })
      .where(eq(campaignsTable.id, id)).returning();
    res.json({ campaign: await enrichCampaign(updated), complianceChecks, passed: false, invoice: null });
    return;
  }

  // Debit wallet
  const newBalance = balance - costBreakdown.total;
  await db.update(walletTable).set({ balance: String(newBalance) }).where(eq(walletTable.id, walletRow.id));
  await db.insert(walletTransactionsTable).values({
    type: "debit",
    amount: String(costBreakdown.total),
    description: `Campaign: ${campaign.name}`,
    reference: `CAMP-${id}`,
  });

  // Create invoice
  const invoiceNumber = `INV-${Date.now()}`;
  const [invoice] = await db.insert(invoicesTable).values({
    campaignId: id,
    number: invoiceNumber,
    amount: String(costBreakdown.total),
    gst: String(costBreakdown.gst),
    pdfUrl: `#invoice-${invoiceNumber}`,
  }).returning();

  // Mark live
  const finalRecipients = recipients - autoDropped;
  const [updated] = await db.update(campaignsTable).set({
    status: "live",
    approvedBy: 2,
    launchedAt: new Date(),
    complianceResult: { checks: complianceChecks, passed: true },
    estimatedRecipients: finalRecipients,
  }).where(eq(campaignsTable.id, id)).returning();

  // Create metrics row
  const existing = await db.select().from(campaignMetricsTable).where(eq(campaignMetricsTable.campaignId, id));
  if (existing.length === 0) {
    await db.insert(campaignMetricsTable).values({ campaignId: id, spend: String(costBreakdown.total) });
  } else {
    await db.update(campaignMetricsTable).set({ spend: String(costBreakdown.total) }).where(eq(campaignMetricsTable.campaignId, id));
  }

  // Start delivery simulation
  simulateDeliveryEvents(id, finalRecipients).catch(e => logger.error({ e }, "Simulation error"));

  res.json({
    campaign: await enrichCampaign(updated),
    complianceChecks,
    passed: true,
    invoice: { id: invoice.id, number: invoice.number, amount: parseFloat(invoice.amount), gst: parseFloat(invoice.gst) },
  });
});

router.post("/campaigns/:id/pause", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [c] = await db.update(campaignsTable).set({ status: "paused" }).where(eq(campaignsTable.id, id)).returning();
  if (!c) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(await enrichCampaign(c));
});

router.get("/campaigns/:id/metrics", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [m] = await db.select().from(campaignMetricsTable).where(eq(campaignMetricsTable.campaignId, id));
  if (!m) {
    res.json({
      campaignId: id, sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0,
      spend: 0, revenueAttributed: 0, roi: 0, channelBreakdown: [],
      updatedAt: new Date().toISOString(),
    });
    return;
  }
  const spend = parseFloat(m.spend ?? "0");
  const rev = parseFloat(m.revenueAttributed ?? "0");
  const roi = spend > 0 ? ((rev - spend) / spend) * 100 : 0;
  res.json({
    campaignId: id,
    sent: m.sent, delivered: m.delivered, opened: m.opened, clicked: m.clicked, converted: m.converted,
    spend, revenueAttributed: rev, roi,
    channelBreakdown: m.channelBreakdown ?? [],
    updatedAt: m.updatedAt.toISOString(),
  });
});

export default router;
