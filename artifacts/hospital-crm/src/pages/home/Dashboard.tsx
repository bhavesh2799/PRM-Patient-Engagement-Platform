import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import {
  SlidersHorizontal, Bell, MessageSquare, MessageCircle, Globe, X,
} from "lucide-react";
import { useLocation } from "wouter";

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp", web_chat: "WhatsApp Chat", form: "Form",
  email: "Email", csv: "CSV Import",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-purple-100 text-purple-700",
  fulfilled: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  live: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
};

function formatRevenue(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor(ms / 60000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function buildQs(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  return qs.toString() ? `?${qs}` : "";
}

function convRateColor(rate: number): string {
  if (rate >= 30) return "text-green-600 font-semibold";
  if (rate > 0) return "text-amber-600 font-semibold";
  return "text-muted-foreground";
}

function ChannelIcon({ channel }: { channel: string }) {
  const cls = "w-4 h-4 shrink-0 mx-auto";
  if (channel === "waba") return <MessageCircle className={`${cls} text-green-600`} />;
  if (channel === "sms") return <MessageSquare className={`${cls} text-blue-600`} />;
  if (channel === "push") return <Bell className={`${cls} text-purple-600`} />;
  if (channel === "web_chat") return <Globe className={`${cls} text-blue-500`} />;
  return <MessageSquare className={`${cls} text-gray-500`} />;
}

export default function HomeDashboard() {
  const [, navigate] = useLocation();
  const [channelFilter, setChannelFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtersActive = !!(channelFilter || dateFrom || dateTo || statusFilter);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard-home", channelFilter, dateFrom, dateTo, statusFilter],
    queryFn: async () => {
      const qs = buildQs({ channel: channelFilter, dateFrom, dateTo, status: statusFilter });
      const r = await fetch(`/api/dashboard/home${qs}`);
      return r.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">Loading…</div>
      </AppLayout>
    );
  }
  if (!dashboard) return null;

  const d = dashboard;
  const totalLeads: number = d.totalLeads ?? 0;
  const newLeads: number = d.newLeads ?? 0;
  const convertedLeads: number = d.convertedLeads ?? 0;
  const appt = d.appointmentSummary ?? {};
  const apptBooked = (appt.booked ?? 0) + (appt.confirmed ?? 0);

  const patientsReached: number = d.patientsReachedMtd ?? 0;
  const activeCampaigns = d.activeCampaigns ?? { total: 0, live: 0, paused: 0 };
  const avgDelivery: number = d.avgDeliveryRate ?? 0;
  const deliveryDelta: number = d.deliveryRateDelta ?? 0;
  const revenue: number = d.revenueAttributed ?? 0;
  const roi: number = d.roi ?? 0;
  const activeCampaignsList: any[] = d.activeCampaignsList ?? [];
  const campaignCount = activeCampaignsList.length;

  const leadsByChannel: any[] = (d.leadsByChannel ?? [])
    .filter((c: any) => c.count > 0)
    .sort((a: any, b: any) => b.count - a.count);
  const maxChannelCount = Math.max(...leadsByChannel.map((c: any) => c.count), 1);

  const leadToOutcome: any[] = (d.leadToOutcomeByChannel ?? []).map((c: any) => ({
    ...c,
    channelLabel: CHANNEL_LABELS[c.channel] ?? c.channel,
  }));

  const trend: any[] = d.trend ?? [];
  const recentLeads: any[] = d.recentLeads ?? [];

  const dateLabel =
    dateFrom && dateTo
      ? `${format(new Date(dateFrom), "d MMM")} – ${format(new Date(dateTo), "d MMM")}`
      : dateFrom
      ? `From ${format(new Date(dateFrom), "d MMM")}`
      : dateTo
      ? `To ${format(new Date(dateTo), "d MMM")}`
      : null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* ── Filter bar ─────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="font-medium">Filters</span>
          </div>
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="text-sm border rounded-full px-3 py-1.5 bg-background cursor-pointer focus:outline-none hover:border-foreground/40 transition-colors"
          >
            <option value="">All channels</option>
            {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border rounded-full px-3 py-1.5 bg-background cursor-pointer focus:outline-none hover:border-foreground/40 transition-colors"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="in_progress">In Progress</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="closed">Closed</option>
          </select>
          {dateLabel ? (
            <div className="flex items-center gap-1 border rounded-full px-3 py-1.5 bg-background text-sm">
              <span>{dateLabel}</span>
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 border rounded-full px-3 py-1.5 bg-background text-sm hover:border-foreground/40 transition-colors">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-transparent text-xs w-24 focus:outline-none cursor-pointer"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-transparent text-xs w-24 focus:outline-none cursor-pointer"
              />
            </div>
          )}
          {filtersActive && (
            <button
              onClick={() => { setChannelFilter(""); setDateFrom(""); setDateTo(""); setStatusFilter(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              Clear all
            </button>
          )}
          {filtersActive && (
            <span className="text-xs text-muted-foreground border rounded-full px-2.5 py-1">
              {totalLeads} leads
            </span>
          )}
        </div>

        {/* ── INCOMING ENGAGEMENTS ─────────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Incoming Engagements
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => navigate("/crm/inbox")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Total leads</p>
                <p className="text-3xl font-bold" data-testid="stat-total-leads">
                  {totalLeads.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {channelFilter ? (CHANNEL_LABELS[channelFilter] ?? channelFilter) : "All channels"}
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-blue-200 transition-colors"
              onClick={() => navigate("/crm/inbox?status=new")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">New (unactioned)</p>
                <p className="text-3xl font-bold text-amber-600" data-testid="stat-new-leads">
                  {newLeads.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-blue-600 mt-1 hover:underline">Click to view →</p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => navigate("/appointments/bookings")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Appointments booked</p>
                <p className="text-3xl font-bold" data-testid="stat-appt-booked">
                  {apptBooked.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">This period</p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-green-200 transition-colors"
              onClick={() => navigate("/crm/inbox?status=fulfilled")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Fulfilled</p>
                <p className="text-3xl font-bold text-green-600" data-testid="stat-converted">
                  {convertedLeads.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-green-600 mt-1 hover:underline">Click to view →</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── OUTGOING ENGAGEMENTS ─────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
              Outgoing Engagements
            </p>
            <span className="text-[11px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">
              new section
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => navigate("/marketing/dashboard")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Patients reached (MTD)</p>
                <p className="text-3xl font-bold text-blue-600">
                  {patientsReached.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {campaignCount} campaign{campaignCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => navigate("/marketing/campaigns")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Active campaigns</p>
                <p className="text-3xl font-bold">{activeCampaigns.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeCampaigns.live} live{activeCampaigns.paused > 0 ? ` · ${activeCampaigns.paused} paused` : ""}
                </p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => navigate("/marketing/dashboard")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Avg delivery rate</p>
                <p className="text-3xl font-bold text-green-600">{avgDelivery}%</p>
                {deliveryDelta > 0 && (
                  <p className="text-xs text-green-600 mt-1">↑ {deliveryDelta}% vs last period</p>
                )}
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => navigate("/marketing/campaigns")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Revenue attributed</p>
                <p className="text-3xl font-bold">{formatRevenue(revenue)}</p>
                {roi > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">ROI {roi}×</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Charts row 1 ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Leads by channel — horizontal bars */}
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Leads by channel</CardTitle>
                <span className="text-[11px] bg-green-100 text-green-700 rounded-full px-2 py-0.5">+ conv. rate</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click a bar to filter inbox · % = fulfilled / total
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {leadsByChannel.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                  No leads match current filters
                </div>
              ) : (
                <div className="space-y-1.5 mt-2">
                  {leadsByChannel.map((ch: any) => (
                    <div
                      key={ch.channel}
                      className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 group"
                      onClick={() => navigate(`/crm/inbox?channel=${ch.channel}`)}
                    >
                      <span className="w-[88px] text-xs text-muted-foreground truncate shrink-0 group-hover:text-foreground transition-colors">
                        {CHANNEL_LABELS[ch.channel] ?? ch.channel}
                      </span>
                      <div className="flex-1 h-[14px] bg-muted/30 rounded-sm overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all"
                          style={{
                            width: `${(ch.count / maxChannelCount) * 100}%`,
                            backgroundColor: "hsl(var(--primary) / 0.65)",
                          }}
                        />
                      </div>
                      <span className="w-5 text-xs font-medium text-right shrink-0">{ch.count}</span>
                      <span className={`w-10 text-right shrink-0 text-xs ${convRateColor(ch.convRate)}`}>
                        {ch.convRate > 0 ? `${ch.convRate}%` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active campaigns mini-table */}
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">Active campaigns</CardTitle>
                  <span className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">new</span>
                </div>
                <button
                  className="text-xs text-blue-600 hover:underline shrink-0"
                  onClick={() => navigate("/marketing/campaigns")}
                >
                  View all →
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Live & recent · by patients reached</p>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {activeCampaignsList.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                  No active campaigns
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left font-medium py-2 px-3">Campaign</th>
                      <th className="text-center font-medium py-2 px-2 w-10">Ch</th>
                      <th className="text-right font-medium py-2 px-2">Reached</th>
                      <th className="text-right font-medium py-2 px-2">Delivery</th>
                      <th className="text-right font-medium py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCampaignsList.map((c: any) => (
                      <tr
                        key={c.id}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate("/marketing/campaigns")}
                      >
                        <td className="py-2 px-3 font-medium text-xs max-w-[120px] truncate">{c.name}</td>
                        <td className="py-2 px-2 text-center">
                          <ChannelIcon channel={c.channel} />
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                          {c.reached.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-muted-foreground">{c.deliveryRate}%</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${CAMPAIGN_STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.status === "completed" ? "done" : c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Charts row 2 ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Lead-to-outcome stacked horizontal bars */}
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">Lead-to-outcome by channel</CardTitle>
                <span className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">new</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Lifecycle stage distribution per source</p>
            </CardHeader>
            <CardContent className="px-3 pb-5">
              {leadToOutcome.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={leadToOutcome}
                      layout="vertical"
                      barSize={14}
                      margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="channelLabel"
                        width={80}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(val, name) => [val, String(name).replace(/_/g, " ")]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Legend
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        formatter={v => String(v).replace(/_/g, " ")}
                      />
                      <Bar dataKey="new" name="New" stackId="s" fill="#bfdbfe" />
                      <Bar dataKey="contacted" name="Contacted" stackId="s" fill="#fde68a" />
                      <Bar dataKey="in_progress" name="In-progress" stackId="s" fill="#ddd6fe" />
                      <Bar dataKey="fulfilled" name="Fulfilled" stackId="s" fill="#bbf7d0" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead volume — last 7 days */}
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Lead volume — last 7 days</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Daily arrivals across all channels</p>
            </CardHeader>
            <CardContent className="px-3 pb-5">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={trend}
                    barCategoryGap="35%"
                    margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" name="Leads" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Recent leads ──────────────────────────────── */}
        <Card>
          <CardHeader className="pt-5 pb-3 px-5 flex-row items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold">Recent leads</CardTitle>
              <span className="text-[11px] bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                + last action &amp; campaign touch
              </span>
            </div>
            <button
              className="text-xs text-blue-600 hover:underline shrink-0"
              onClick={() => navigate("/crm/inbox")}
            >
              View all →
            </button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left font-medium py-2 px-5">Patient name</th>
                  <th className="text-left font-medium py-2 px-2">Channel</th>
                  <th className="text-left font-medium py-2 px-2">Status</th>
                  <th className="text-left font-medium py-2 px-2">
                    Last action{" "}
                    <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] ml-0.5">new</span>
                  </th>
                  <th className="text-left font-medium py-2 px-2">
                    Campaign touch{" "}
                    <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] ml-0.5">new</span>
                  </th>
                  <th className="text-right font-medium py-2 px-5">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No leads match current filters
                    </td>
                  </tr>
                ) : (
                  recentLeads.map((lead: any) => {
                    const daysSince = (Date.now() - new Date(lead.lastActionAt).getTime()) / 86400000;
                    const isNoAction = lead.lastActionDescription === "No action yet";
                    const isSlaWarning = isNoAction && daysSince > 1;
                    return (
                      <tr
                        key={lead.id}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate("/crm/inbox")}
                      >
                        <td className="py-2.5 px-5 font-medium text-sm">
                          {lead.firstName} {lead.lastName}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">
                          {CHANNEL_LABELS[lead.sourceChannel] ?? lead.sourceChannel}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {lead.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(lead.lastActionAt)} · {lead.lastActionDescription}
                          {isSlaWarning && <span className="ml-1 text-amber-500">⚠</span>}
                        </td>
                        <td className="py-2.5 px-2">
                          {lead.campaignTouchName ? (
                            <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                              {lead.campaignTouchName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-5 text-xs text-muted-foreground text-right">
                          {format(new Date(lead.createdAt), "d MMM")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
