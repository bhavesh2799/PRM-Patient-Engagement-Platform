import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  leadsTable, appointmentsTable, campaignsTable,
  campaignMetricsTable, walletTable, usersTable, doctorsTable
} from "@workspace/db";
import { eq } from "drizzle-orm";

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

  let leads = await db.select().from(leadsTable).orderBy(leadsTable.createdAt);
  if (channel) leads = leads.filter(l => l.sourceChannel === channel);
  if (status) leads = leads.filter(l => l.status === status);
  if (ownerId) leads = leads.filter(l => l.ownerUserId === parseInt(ownerId, 10));
  if (dateFrom) leads = leads.filter(l => new Date(l.createdAt) >= new Date(dateFrom));
  if (dateTo) leads = leads.filter(l => new Date(l.createdAt) <= new Date(dateTo));

  const channels = ["waba", "web_chat", "form", "csv", "app_booking", "web_booking", "push"];
  const leadsByChannel = channels.map(ch => ({
    channel: ch,
    count: leads.filter(l => l.sourceChannel === ch).length,
  }));

  const statuses = ["new", "contacted", "in_progress", "fulfilled", "closed"];
  const funnel = statuses.map(s => ({
    status: s,
    count: leads.filter(l => l.status === s).length,
  }));

  // Last 7 days trend
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const dayLeads = leads.filter(l => {
      const ld = new Date(l.createdAt);
      return ld.toDateString() === d.toDateString();
    });
    return { date: label, count: dayLeads.length };
  });

  const appointments = await db.select().from(appointmentsTable);
  const apptSummary = {
    total: appointments.length,
    booked: appointments.filter(a => a.status === "booked").length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  const recentLeads = await Promise.all(leads.slice(-10).reverse().map(async (l) => {
    const owner = l.ownerUserId
      ? (await db.select().from(usersTable).where(eq(usersTable.id, l.ownerUserId)))[0]
      : null;
    return {
      ...l,
      ownerName: owner?.name ?? null,
      createdAt: l.createdAt.toISOString(),
      lastActionAt: l.lastActionAt.toISOString(),
    };
  }));

  res.json({
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === "new").length,
    convertedLeads: leads.filter(l => l.status === "fulfilled").length,
    leadsByChannel,
    funnel,
    trend,
    appointmentSummary: apptSummary,
    recentLeads,
  });
});

router.get("/dashboard/crm", async (req, res): Promise<void> => {
  const { channel, dateFrom, dateTo } = req.query as Record<string, string>;
  let leads = await db.select().from(leadsTable);
  if (channel) leads = leads.filter(l => l.sourceChannel === channel);
  if (dateFrom) leads = leads.filter(l => new Date(l.createdAt) >= new Date(dateFrom));
  if (dateTo) leads = leads.filter(l => new Date(l.createdAt) <= new Date(dateTo));

  const channels = ["waba", "web_chat", "form", "csv", "app_booking", "web_booking", "push"];
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
      total: dl.length,
      fulfilled: dl.filter(l => l.status === "fulfilled").length,
    };
  });

  res.json({
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === "new").length,
    fulfilledLeads: leads.filter(l => l.status === "fulfilled").length,
    closedLeads: leads.filter(l => l.status === "closed").length,
    slaBreach,
    byChannel,
    trend,
    optOutRate: leads.length ? Math.round((leads.filter(l => !l.optedIn).length / leads.length) * 100) : 0,
  });
});

router.get("/dashboard/engagement", async (_req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable);
  const metrics = await db.select().from(campaignMetricsTable);
  const [wallet] = await db.select().from(walletTable);

  const liveCampaigns = campaigns.filter(c => c.status === "live");
  const totalSent = metrics.reduce((s, m) => s + m.sent, 0);
  const totalDelivered = metrics.reduce((s, m) => s + m.delivered, 0);
  const totalConverted = metrics.reduce((s, m) => s + m.converted, 0);
  const totalSpend = metrics.reduce((s, m) => s + parseFloat(m.spend ?? "0"), 0);
  const totalRevenue = metrics.reduce((s, m) => s + parseFloat(m.revenueAttributed ?? "0"), 0);

  const recentCampaigns = await Promise.all(campaigns.slice(-5).reverse().map(async c => {
    const m = metrics.find(m => m.campaignId === c.id);
    return {
      id: c.id,
      name: c.name,
      goal: c.goal,
      status: c.status,
      sent: m?.sent ?? 0,
      delivered: m?.delivered ?? 0,
      converted: m?.converted ?? 0,
      spend: parseFloat((m?.spend ?? "0").toString()),
      createdAt: c.createdAt.toISOString(),
    };
  }));

  res.json({
    patientsReachedMtd: totalSent,
    deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
    totalConversions: totalConverted,
    activeCampaigns: liveCampaigns.length,
    walletBalance: parseFloat(wallet?.balance ?? "0"),
    totalSpend,
    totalRevenue,
    roi: totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0,
    recentCampaigns,
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
