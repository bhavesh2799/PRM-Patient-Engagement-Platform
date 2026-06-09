import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { TrendingUp, Users, Calendar, CheckCircle, Filter, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp",
  web_chat: "Web Chat",
  form: "Web Form",
  csv: "CSV Import",
  app_booking: "App Booking",
  web_booking: "Web Booking",
  push: "Push",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-purple-100 text-purple-800",
  fulfilled: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-700",
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
];

function buildQs(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  return qs.toString() ? `?${qs}` : "";
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

  const clearFilters = () => {
    setChannelFilter("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          Loading dashboard…
        </div>
      </AppLayout>
    );
  }

  if (!dashboard) return null;

  const appt = dashboard.appointmentSummary ?? {};
  const leadsByChannel: Array<{ channel: string; count: number }> = dashboard.leadsByChannel ?? [];
  const funnel: Array<{ status: string; count: number }> = dashboard.funnel ?? [];
  const trend: Array<{ date: string; count: number }> = dashboard.trend ?? [];
  const recentLeads: any[] = dashboard.recentLeads ?? [];
  const totalLeads: number = dashboard.totalLeads ?? 0;
  const newLeads: number = dashboard.newLeads ?? 0;
  const convertedLeads: number = dashboard.convertedLeads ?? 0;

  const channelChartData = leadsByChannel
    .filter(d => d.count > 0)
    .map(d => ({ channel: CHANNEL_LABELS[d.channel] ?? d.channel, count: d.count, key: d.channel }));

  const funnelChartData = funnel.map(d => ({
    stage: d.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
    count: d.count,
    status: d.status,
  }));

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live overview of all incoming and outgoing hospital engagements.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </div>
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="text-sm border rounded px-2.5 py-1.5 bg-background"
            >
              <option value="">All channels</option>
              {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border rounded px-2.5 py-1.5 bg-background"
            >
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="in_progress">In Progress</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="closed">Closed</option>
            </select>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="text-sm border rounded px-2.5 py-1.5 bg-background"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="text-sm border rounded px-2.5 py-1.5 bg-background"
              />
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-muted-foreground">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
            {filtersActive && (
              <Badge variant="secondary" className="text-xs">
                Filtered view — {totalLeads} leads
              </Badge>
            )}
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate("/crm")}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Total Leads</span>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold" data-testid="stat-total-leads">
                {totalLeads.toLocaleString("en-IN")}
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-blue-300 transition-colors"
            onClick={() => navigate("/crm?status=new")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">New (Unactioned)</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-600" data-testid="stat-new-leads">
                {newLeads.toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Click to view →</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate("/appointments")}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Appointments Booked</span>
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold" data-testid="stat-appt-booked">
                {(appt.booked ?? 0) + (appt.confirmed ?? 0)}
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-green-300 transition-colors"
            onClick={() => navigate("/crm?status=fulfilled")}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Fulfilled</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-600" data-testid="stat-converted">
                {convertedLeads.toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Click to view →</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Leads by Channel — clickable bars */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Leads by Channel</CardTitle>
              <p className="text-xs text-muted-foreground">Click a bar to filter inbox by that channel</p>
            </CardHeader>
            <CardContent>
              {channelChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  No leads match current filters
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={channelChartData}
                      barCategoryGap="40%"
                      onClick={d => {
                        if (d?.activePayload?.[0]?.payload?.key) {
                          navigate(`/crm?channel=${d.activePayload[0].payload.key}`);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="channel" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: "hsl(var(--accent))" }} />
                      <Bar dataKey="count" name="Leads" radius={[3, 3, 0, 0]}>
                        {channelChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Lifecycle Funnel — clickable bars */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Lead Status Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">Click a bar to filter inbox by that status</p>
            </CardHeader>
            <CardContent>
              {funnelChartData.every(d => d.count === 0) ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  No leads match current filters
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={funnelChartData}
                      layout="vertical"
                      barCategoryGap="30%"
                      onClick={d => {
                        if (d?.activePayload?.[0]?.payload?.status) {
                          navigate(`/crm?status=${d.activePayload[0].payload.status}`);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Leads" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} className="cursor-pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 7-day trend */}
        {trend.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Lead Volume — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Leads"
                      stroke="hsl(var(--primary))"
                      fill="url(#trendGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointment Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Appts", value: appt.total ?? 0 },
            { label: "Confirmed", value: appt.confirmed ?? 0, color: "text-blue-600" },
            { label: "Completed", value: appt.completed ?? 0, color: "text-green-600" },
            { label: "Cancelled", value: appt.cancelled ?? 0, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
                <div className={`text-2xl font-bold ${color ?? ""}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Leads Table */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
            <Button variant="link" size="sm" className="text-xs" onClick={() => navigate("/crm")}>
              View all →
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Patient Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="pr-6">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No leads match current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  recentLeads.map((lead: any) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      data-testid={`row-lead-${lead.id}`}
                      onClick={() => navigate("/crm")}
                    >
                      <TableCell className="font-medium pl-6">
                        {lead.firstName} {lead.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {lead.mobile}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {CHANNEL_LABELS[lead.sourceChannel] ?? lead.sourceChannel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {lead.status.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{lead.ownerName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm pr-6">
                        {format(new Date(lead.createdAt), "dd MMM, h:mm a")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
