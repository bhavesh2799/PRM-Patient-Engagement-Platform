import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  leadsTable, appointmentsTable, campaignsTable,
  campaignMetricsTable, walletTable, usersTable, doctorsTable, segmentsTable,
  activityLogTable
} from "@workspace/db";

const router: IRouter = Router();

function ago(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

router.get("/dashboard/home", async (req, res): Promise<void> => {
  const { channel, status, ownerId, dateFrom, dateTo } = req.query as Record<string, string>;

  const [allLeads, appointments, campaigns, campaignMetrics, segments, users, allLogs] = await Promise.all([
    db.select().from(leadsTable).orderBy(leadsTable.createdAt),
    db.select().from(appointmentsTable),
    db.select().from(campaignsTable),
    db.select().from(campaignMetricsTable),
    db.select().from(segmentsTable),
    db.select().from(usersTable),
    db.select().from(activityLogTable),
  ]);

  let leads = [...allLeads];
  if (channel) leads = leads.filter(l => l.sourceChannel === channel);
  if (status) leads = leads.filter(l => l.status === status);
  if (ownerId) leads = leads.filter(l => l.ownerUserId === parseInt(ownerId, 10));
  if (dateFrom) leads = leads.filter(l => new Date(l.createdAt) >= new Date(dateFrom));
  if (dateTo) leads = leads.filter(l => new Date(l.createdAt) <= new Date(dateTo));

  const CHANNELS = ["waba", "web_chat", "form", "csv", "app_booking", "web_booking", "email", "medicine_order", "lab_test", "web_appointment", "app_appointment"];

  const leadsByChannel = CHANNELS.map(ch => {
    const chLeads = leads.filter(l => l.sourceChannel === ch);
    const fulfilled = chLeads.filter(l => l.status === "fulfilled").length;
    return {
      channel: ch,
      count: chLeads.length,
      fulfilled,
      convRate: chLeads.length > 0 ? Math.round((fulfilled / chLeads.length) * 100) : 0,
    };
  });

  const statuses = ["new", "contacted", "in_progress", "fulfilled", "closed"];
  const funnel = statuses.map(s => ({
    status: s,
    count: leads.filter(l => l.status === s).length,
  }));

  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const dayLeads = leads.filter(l => new Date(l.createdAt).toDateString() === d.toDateString());
    return { date: label, count: dayLeads.length };
  });

  const apptSummary = {
    total: appointments.length,
    booked: appointments.filter(a => a.status === "booked").length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  // Outgoing / campaign stats
  const liveCampaigns = campaigns.filter(c => c.status === "live");
  const pausedCampaigns = campaigns.filter(c => c.status === "paused");
  const totalSent = campaignMetrics.reduce((s, m) => s + m.sent, 0);
  const totalDelivered = campaignMetrics.reduce((s, m) => s + m.delivered, 0);
  const totalRevenue = campaignMetrics.reduce((s, m) => s + parseFloat(String(m.revenueAttributed ?? "0")), 0);
  const totalSpend = campaignMetrics.reduce((s, m) => s + parseFloat(String(m.spend ?? "0")), 0);

  const activeCampaignsList = campaigns
    .filter(c => ["live", "paused", "completed"].includes(c.status))
    .sort((a, b) => {
      const order = ["live", "paused", "completed"];
      const ai = order.indexOf(a.status), bi = order.indexOf(b.status);
      return ai !== bi ? ai - bi : b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 5)
    .map(c => {
      const m = campaignMetrics.find(m => m.campaignId === c.id);
      const sent = m?.sent ?? 0;
      const delivered = m?.delivered ?? 0;
      const opened = m?.opened ?? 0;
      const clicked = m?.clicked ?? 0;
      const conversions = m?.converted ?? 0;
      const revenue = parseFloat(String(m?.revenueAttributed ?? "0"));
      const spend = parseFloat(String(m?.spend ?? "0"));
      const chs = (c.channels as Array<{ channel: string }> | null) ?? [];
      const firstChannel = Array.isArray(chs) && chs.length > 0
        ? (typeof chs[0] === "string" ? chs[0] : (chs[0] as { channel: string }).channel)
        : "sms";
      return {
        id: c.id,
        name: c.name,
        goal: c.goal ?? "",
        channel: firstChannel,
        reached: sent,
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        ctr: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
        conversions,
        revenueAttributed: revenue,
        costPerConversion: conversions > 0 ? Math.round(spend / conversions) : 0,
        status: c.status,
      };
    });

  // Stacked lead-to-outcome by channel
  const leadToOutcomeByChannel = CHANNELS
    .map(ch => {
      const cl = leads.filter(l => l.sourceChannel === ch);
      if (cl.length === 0) return null;
      return {
        channel: ch,
        new: cl.filter(l => l.status === "new").length,
        contacted: cl.filter(l => l.status === "contacted").length,
        in_progress: cl.filter(l => l.status === "in_progress").length,
        fulfilled: cl.filter(l => l.status === "fulfilled").length,
      };
    })
    .filter(Boolean);

  // Campaign touch: lead → segment membership → campaign
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  function getCampaignTouch(leadId: number): { id: number; name: string } | null {
    const seg = segments.find(s => {
      const ids = s.memberLeadIds as number[];
      return Array.isArray(ids) && ids.includes(leadId);
    });
    if (!seg) return null;
    const campaign = campaigns.find(c =>
      c.audienceSegmentId === seg.id && ["live", "completed", "paused"].includes(c.status)
    );
    return campaign ? { id: campaign.id, name: campaign.name } : null;
  }

  function getLastActionDescription(l: typeof allLeads[0]): string {
    if (l.status === "fulfilled") return "Appt confirmed";
    if (l.status === "contacted") return "Call attempted";
    if (l.status === "in_progress") return "Status updated";
    if (l.status === "closed") return "Case closed";
    return "No action yet";
  }

  const recentLeads = leads.slice(-10).reverse().map(l => {
    const touch = getCampaignTouch(l.id);
    return {
      ...l,
      ownerName: l.ownerUserId ? (userMap[l.ownerUserId] ?? null) : null,
      createdAt: l.createdAt.toISOString(),
      lastActionAt: l.lastActionAt.toISOString(),
      lastActionDescription: getLastActionDescription(l),
      campaignTouchName: touch?.name ?? null,
      campaignTouchId: touch?.id ?? null,
    };
  });

  // ── Lead ageing (unactioned "new" leads) + SLA ────────────────
  const ageHours = (l: typeof allLeads[0]) => (Date.now() - new Date(l.createdAt).getTime()) / 3600000;
  const newLeadsArr = leads.filter(l => l.status === "new");
  const leadAgeing = {
    lt6h: newLeadsArr.filter(l => ageHours(l) < 6).length,
    h6_24: newLeadsArr.filter(l => ageHours(l) >= 6 && ageHours(l) < 24).length,
    h24_72: newLeadsArr.filter(l => ageHours(l) >= 24 && ageHours(l) < 72).length,
    gt72: newLeadsArr.filter(l => ageHours(l) >= 72).length,
  };
  const slaBreach = newLeadsArr.filter(l => ageHours(l) >= 24).length;
  const fulfilledCount = leads.filter(l => l.status === "fulfilled").length;

  // ── Outreach aggregate funnel ─────────────────────────────────
  const totalOpened = campaignMetrics.reduce((s, m) => s + (m.opened ?? 0), 0);
  const totalClicked = campaignMetrics.reduce((s, m) => s + (m.clicked ?? 0), 0);
  const totalConverted = campaignMetrics.reduce((s, m) => s + (m.converted ?? 0), 0);

  // ── Owner workload (over all leads) with SLA breach counts ─────
  const ownerWorkload = users.map((u, i) => {
    const ul = allLeads.filter(l => l.ownerUserId === u.id);
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      idx: i,
      new: ul.filter(l => l.status === "new").length,
      in_progress: ul.filter(l => l.status === "in_progress").length,
      fulfilled: ul.filter(l => l.status === "fulfilled").length,
      total: ul.length,
      breached: ul.filter(l => l.status === "new" && ageHours(l) >= 24).length,
    };
  }).filter(u => u.total > 0).sort((a, b) => b.breached - a.breached || b.total - a.total);

  // ── SLA watchlist: oldest unactioned leads ────────────────────
  const slaWatchlist = newLeadsArr
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 6)
    .map(l => {
      const touch = getCampaignTouch(l.id);
      return {
        id: l.id,
        name: `${l.firstName} ${l.lastName}`.trim(),
        channel: l.sourceChannel,
        ownerName: l.ownerUserId ? (userMap[l.ownerUserId] ?? null) : null,
        ageHours: Math.round(ageHours(l)),
        campaignTouchName: touch?.name ?? null,
      };
    });

  // ── TTFA median ───────────────────────────────────────────────
  const ttfaValues: number[] = [];
  for (const lead of leads) {
    const firstAction = allLogs
      .filter(a => a.leadId === lead.id && a.type !== "created")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    if (firstAction) {
      const diff = (new Date(firstAction.createdAt).getTime() - new Date(lead.createdAt).getTime()) / 60000;
      if (diff >= 0) ttfaValues.push(diff);
    }
  }
  const ttfaSorted = ttfaValues.sort((a, b) => a - b);
  const ttfaMedianMinutes = ttfaSorted.length > 0 ? Math.round(ttfaSorted[Math.floor(ttfaSorted.length / 2)]) : null;

  res.json({
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === "new").length,
    inProgressLeads: leads.filter(l => l.status === "in_progress").length,
    convertedLeads: fulfilledCount,
    conversionRate: leads.length ? Math.round((fulfilledCount / leads.length) * 100) : 0,
    slaBreach,
    slaBreachRate: leads.length ? Math.round((slaBreach / leads.length) * 100) : 0,
    leadAgeing,
    ageSummary: { critical: leadAgeing.gt72, atRisk: leadAgeing.h24_72, onTime: leadAgeing.lt6h + leadAgeing.h6_24 },
    ttfaMedianMinutes,
    ownerWorkload,
    slaWatchlist,
    leadsByChannel,
    funnel,
    trend,
    appointmentSummary: apptSummary,
    recentLeads,
    patientsReachedMtd: totalSent,
    outreach: {
      sent: totalSent,
      delivered: totalDelivered,
      opened: totalOpened,
      clicked: totalClicked,
      converted: totalConverted,
      spend: totalSpend,
      revenue: totalRevenue,
      roas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 10) / 10 : 0,
    },
    activeCampaigns: {
      total: liveCampaigns.length + pausedCampaigns.length,
      live: liveCampaigns.length,
      paused: pausedCampaigns.length,
    },
    avgDeliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
    deliveryRateDelta: 4,
    revenueAttributed: totalRevenue,
    roi: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 10) / 10 : 0,
    activeCampaignsList,
    leadToOutcomeByChannel,
  });
});

router.get("/dashboard/crm", async (req, res): Promise<void> => {
  const { channel, ownerId, dateFrom, dateTo } = req.query as Record<string, string>;
  let leads = await db.select().from(leadsTable);
  if (channel) leads = leads.filter(l => l.sourceChannel === channel);
  if (ownerId) leads = leads.filter(l => l.ownerUserId === parseInt(ownerId, 10));
  if (dateFrom) leads = leads.filter(l => new Date(l.createdAt) >= new Date(dateFrom));
  if (dateTo) leads = leads.filter(l => new Date(l.createdAt) <= new Date(dateTo));

  const channels = ["waba", "web_chat", "form", "email", "csv", "walk_in", "app_booking", "web_booking", "medicine_order", "lab_test", "web_appointment", "app_appointment"];
  const byChannel = channels.map(ch => {
    const cl = leads.filter(l => l.sourceChannel === ch);
    return {
      channel: ch,
      count: cl.length,
      fulfilled: cl.filter(l => l.status === "fulfilled").length,
      conversionRate: cl.length ? Math.round((cl.filter(l => l.status === "fulfilled").length / cl.length) * 100) : 0,
    };
  });

  // SLA breaches: leads older than 24h still in "new"
  const slaBreach = leads.filter(l =>
    l.status === "new" && (Date.now() - new Date(l.createdAt).getTime()) > 24 * 60 * 60 * 1000
  ).length;

  const trend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const label = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const dl = leads.filter(l => new Date(l.createdAt).toDateString() === d.toDateString());
    return {
      date: label,
      count: dl.length,
      total: dl.length,
      fulfilled: dl.filter(l => l.status === "fulfilled").length,
    };
  });

  // TTFA (Time-to-first-action) — median minutes from lead creation to first non-"created" activity
  const allLogs = await db.select().from(activityLogTable);
  const ttfaValues: number[] = [];
  for (const lead of leads) {
    const firstAction = allLogs
      .filter(a => a.leadId === lead.id && a.type !== "created")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    if (firstAction) {
      const diff = (new Date(firstAction.createdAt).getTime() - new Date(lead.createdAt).getTime()) / 60000;
      if (diff >= 0) ttfaValues.push(diff);
    }
  }
  const sorted = ttfaValues.sort((a, b) => a - b);
  const ttfaMedianMinutes = sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null;

  // Owner workload
  const allUsers = await db.select().from(usersTable);
  const allLeadsUnfiltered = ownerId ? await db.select().from(leadsTable) : leads;
  const crmAgeHours = (l: typeof leads[0]) => (Date.now() - new Date(l.createdAt).getTime()) / 3600000;
  const ownerWorkload = allUsers.map((u, i) => {
    const ul = allLeadsUnfiltered.filter(l => l.ownerUserId === u.id);
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      idx: i,
      new: ul.filter(l => l.status === "new").length,
      contacted: ul.filter(l => l.status === "contacted").length,
      in_progress: ul.filter(l => l.status === "in_progress").length,
      fulfilled: ul.filter(l => l.status === "fulfilled").length,
      total: ul.length,
      breached: ul.filter(l => l.status === "new" && crmAgeHours(l) >= 24).length,
    };
  }).filter(u => u.total > 0).sort((a, b) => b.breached - a.breached || b.total - a.total);

  // ── Lead ageing (unactioned "new") ────────────────────────────
  const crmNew = leads.filter(l => l.status === "new");
  const leadAgeing = {
    lt6h: crmNew.filter(l => crmAgeHours(l) < 6).length,
    h6_24: crmNew.filter(l => crmAgeHours(l) >= 6 && crmAgeHours(l) < 24).length,
    h24_72: crmNew.filter(l => crmAgeHours(l) >= 24 && crmAgeHours(l) < 72).length,
    gt72: crmNew.filter(l => crmAgeHours(l) >= 72).length,
  };
  const fulfilledLeads = leads.filter(l => l.status === "fulfilled").length;

  res.json({
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === "new").length,
    fulfilledLeads,
    closedLeads: leads.filter(l => l.status === "closed").length,
    inProgressLeads: leads.filter(l => l.status === "in_progress").length,
    conversionRate: leads.length ? Math.round((fulfilledLeads / leads.length) * 100) : 0,
    slaBreach,
    slaBreachRate: leads.length ? Math.round((slaBreach / leads.length) * 100) : 0,
    leadAgeing,
    ageSummary: { critical: leadAgeing.gt72, atRisk: leadAgeing.h24_72, onTime: leadAgeing.lt6h + leadAgeing.h6_24 },
    byChannel,
    trend,
    optOutRate: leads.length ? Math.round((leads.filter(l => !l.optedIn).length / leads.length) * 100) : 0,
    dndRate: leads.length ? Math.round((leads.filter(l => l.dndListed).length / leads.length) * 100) : 0,
    ttfaMedianMinutes,
    ownerWorkload,
  });
});

router.get("/dashboard/engagement", async (_req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable);
  const metrics = await db.select().from(campaignMetricsTable);
  const [wallet] = await db.select().from(walletTable);

  const liveCampaigns = campaigns.filter(c => c.status === "live");
  const totalSent = metrics.reduce((s, m) => s + m.sent, 0);
  const totalDelivered = metrics.reduce((s, m) => s + m.delivered, 0);
  const totalOpened = metrics.reduce((s, m) => s + (m.opened ?? 0), 0);
  const totalClicked = metrics.reduce((s, m) => s + (m.clicked ?? 0), 0);
  const totalConverted = metrics.reduce((s, m) => s + m.converted, 0);
  const totalSpend = metrics.reduce((s, m) => s + parseFloat(m.spend ?? "0"), 0);
  const totalRevenue = metrics.reduce((s, m) => s + parseFloat(m.revenueAttributed ?? "0"), 0);

  function firstChannelOf(c: typeof campaigns[0]): string {
    const chs = (c.channels as Array<{ channel: string } | string> | null) ?? [];
    if (Array.isArray(chs) && chs.length > 0) {
      const first = chs[0];
      return typeof first === "string" ? first : first.channel;
    }
    return "sms";
  }

  const recentCampaigns = campaigns.slice(-6).reverse().map(c => {
    const m = metrics.find(m => m.campaignId === c.id);
    const sent = m?.sent ?? 0;
    const delivered = m?.delivered ?? 0;
    const opened = m?.opened ?? 0;
    const clicked = m?.clicked ?? 0;
    const converted = m?.converted ?? 0;
    const spend = parseFloat((m?.spend ?? "0").toString());
    const revenue = parseFloat((m?.revenueAttributed ?? "0").toString());
    return {
      id: c.id,
      name: c.name,
      goal: c.goal,
      status: c.status,
      channel: firstChannelOf(c),
      sent,
      delivered,
      opened,
      clicked,
      converted,
      spend,
      revenueAttributed: revenue,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      ctr: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
      convRate: sent > 0 ? Math.round((converted / sent) * 1000) / 10 : 0,
      costPerConversion: converted > 0 ? Math.round(spend / converted) : 0,
      createdAt: c.createdAt.toISOString(),
    };
  });

  // ── Featured campaign: best by revenue, full funnel ───────────
  let featuredCampaign: Record<string, unknown> | null = null;
  const ranked = campaigns
    .map(c => ({ c, m: metrics.find(mm => mm.campaignId === c.id) }))
    .filter(x => (x.m?.sent ?? 0) > 0)
    .sort((a, b) =>
      parseFloat(String(b.m?.revenueAttributed ?? "0")) - parseFloat(String(a.m?.revenueAttributed ?? "0")) ||
      (b.m?.sent ?? 0) - (a.m?.sent ?? 0)
    );
  if (ranked.length > 0) {
    const { c, m } = ranked[0];
    const sent = m?.sent ?? 0;
    const delivered = m?.delivered ?? 0;
    const opened = m?.opened ?? 0;
    const clicked = m?.clicked ?? 0;
    const converted = m?.converted ?? 0;
    const spend = parseFloat(String(m?.spend ?? "0"));
    const revenue = parseFloat(String(m?.revenueAttributed ?? "0"));
    featuredCampaign = {
      id: c.id,
      name: c.name,
      goal: c.goal,
      status: c.status,
      channel: firstChannelOf(c),
      sent, delivered, opened, clicked, converted, spend,
      revenueAttributed: revenue,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      ctr: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
      convRate: sent > 0 ? Math.round((converted / sent) * 1000) / 10 : 0,
      costPerConversion: converted > 0 ? Math.round(spend / converted) : 0,
      roas: spend > 0 ? Math.round((revenue / spend) * 10) / 10 : 0,
    };
  }

  res.json({
    patientsReachedMtd: totalSent,
    deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
    openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0,
    ctr: totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 100) : 0,
    convRate: totalSent > 0 ? Math.round((totalConverted / totalSent) * 1000) / 10 : 0,
    totalConversions: totalConverted,
    totalDelivered,
    totalOpened,
    totalClicked,
    activeCampaigns: liveCampaigns.length,
    walletBalance: parseFloat(wallet?.balance ?? "0"),
    totalSpend,
    totalRevenue,
    roas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 10) / 10 : 0,
    costPerPatient: totalSent > 0 ? Math.round((totalSpend / totalSent) * 100) / 100 : 0,
    costPerConversion: totalConverted > 0 ? Math.round(totalSpend / totalConverted) : 0,
    roi: totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0,
    recentCampaigns,
    featuredCampaign,
  });
});

router.get("/dashboard/appointments", async (req, res): Promise<void> => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  let appts = await db.select().from(appointmentsTable);
  if (dateFrom) appts = appts.filter(a => new Date(a.datetime) >= new Date(dateFrom));
  if (dateTo) appts = appts.filter(a => new Date(a.datetime) <= new Date(dateTo));

  const byChannel = ["app_booking", "web_booking"].map(ch => ({
    channel: ch,
    count: appts.filter(a => a.sourceChannel === ch).length,
  }));

  const byStatus = ["booked", "confirmed", "completed", "cancelled"].map(s => ({
    status: s,
    count: appts.filter(a => a.status === s).length,
  }));

  const doctors = await db.select().from(doctorsTable);
  const byDoctor = doctors.map(d => ({
    doctorId: d.id,
    name: d.name,
    specialization: d.specialization,
    count: appts.filter(a => a.doctorId === d.id).length,
    completed: appts.filter(a => a.doctorId === d.id && a.status === "completed").length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

  const bySpecialization = Object.entries(groupBy(appts, a => a.specialization)).map(([spec, items]) => ({
    specialization: spec,
    count: items.length,
  })).sort((a, b) => b.count - a.count);

  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const da = appts.filter(a => new Date(a.datetime).toDateString() === d.toDateString());
    return { date: label, count: da.length, completed: da.filter(a => a.status === "completed").length };
  });

  res.json({
    total: appts.length,
    byChannel,
    byStatus,
    byDoctor,
    bySpecialization,
    trend,
    completionRate: appts.length > 0 ? Math.round((appts.filter(a => a.status === "completed").length / appts.length) * 100) : 0,
    cancellationRate: appts.length > 0 ? Math.round((appts.filter(a => a.status === "cancelled").length / appts.length) * 100) : 0,
  });
});

router.get("/dashboard/super-admin", async (_req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable);
  const metrics = await db.select().from(campaignMetricsTable);
  const [wallet] = await db.select().from(walletTable);
  const users = await db.select().from(usersTable);
  const leads = await db.select().from(leadsTable);

  const submitted = campaigns.filter(c => c.status === "submitted");
  const live = campaigns.filter(c => c.status === "live");

  res.json({
    totalUsers: users.length,
    totalLeads: leads.length,
    totalCampaigns: campaigns.length,
    submittedForApproval: submitted.length,
    liveCampaigns: live.length,
    walletBalance: parseFloat(wallet?.balance ?? "0"),
    totalSpend: metrics.reduce((s, m) => s + parseFloat(m.spend ?? "0"), 0),
    pendingTemplateRequests: 0,
    recentSubmissions: submitted.map(c => ({
      id: c.id,
      name: c.name,
      goal: c.goal,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

export default router;
