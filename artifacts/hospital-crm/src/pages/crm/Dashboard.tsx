import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useGetSessionRole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { AlertTriangle, Timer, Users } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface CrmDashboardData {
  totalLeads: number;
  newLeads: number;
  fulfilledLeads: number;
  closedLeads: number;
  inProgressLeads: number;
  slaBreach: number;
  byChannel: { channel: string; count: number; fulfilled: number; conversionRate: number }[];
  trend: { date: string; total: number; fulfilled: number }[];
  optOutRate: number;
  dndRate: number;
  ttfaMedianMinutes: number | null;
  ownerWorkload: {
    userId: number; name: string; role: string;
    new: number; contacted: number; in_progress: number; fulfilled: number; total: number;
  }[];
}

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp", web_chat: "Web Chat", form: "Web Form",
  csv: "CSV", app_booking: "App", web_booking: "Web", push: "Push",
};

const CHANNEL_COLORS: Record<string, string> = {
  waba: "#22c55e", web_chat: "#3b82f6", form: "#f97316",
  csv: "#94a3b8", app_booking: "#8b5cf6", web_booking: "#6366f1", push: "#ec4899",
};

function formatTtfa(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function CrmDashboard() {
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [, setLocation] = useLocation();

  const { data: session } = useGetSessionRole() as { data?: { role: string } };
  const canSeeWorkload = session?.role === "manager" || session?.role === "ap_admin";

  const params = new URLSearchParams();
  if (channelFilter !== "all") params.set("channel", channelFilter);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (ownerFilter) params.set("ownerId", ownerFilter);
  const paramStr = params.toString();

  const { data: d, isLoading } = useQuery<CrmDashboardData>({
    queryKey: ["crm-dashboard", channelFilter, dateFrom, dateTo, ownerFilter],
    queryFn: () => fetch(`/api/dashboard/crm${paramStr ? `?${paramStr}` : ""}`).then(r => r.json()),
  });

  const { data: users = [] } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then(r => r.json()),
  });

  if (isLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96 text-muted-foreground">Loading dashboard…</div>
    </AppLayout>
  );
  if (!d) return null;

  const slaBreach = d.slaBreach ?? 0;

  const channelChartData = d.byChannel
    .filter(c => c.count > 0)
    .map(c => ({
      ...c,
      channelLabel: CHANNEL_LABELS[c.channel] ?? c.channel,
      color: CHANNEL_COLORS[c.channel] ?? "#94a3b8",
    }));

  const hasFilters = channelFilter !== "all" || ownerFilter || dateFrom || dateTo;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CRM Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Incoming lead performance, SLA tracking, and team workload.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
          <span className="text-sm font-medium text-muted-foreground">Filters:</span>
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 bg-background"
          >
            {["all", "waba", "web_chat", "form", "csv", "app_booking", "web_booking", "push"].map(c => (
              <option key={c} value={c}>{c === "all" ? "All channels" : CHANNEL_LABELS[c] ?? c}</option>
            ))}
          </select>
          <select
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All owners</option>
            {users.filter(u => u.role !== "ap_admin").map(u => (
              <option key={u.id} value={String(u.id)}>{u.name}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 bg-background" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 bg-background" />
          {hasFilters && (
            <button
              onClick={() => { setChannelFilter("all"); setOwnerFilter(""); setDateFrom(""); setDateTo(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* SLA banner — clickable */}
        {slaBreach > 0 && (
          <button
            className="w-full flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 hover:bg-red-100 transition-colors text-left"
            onClick={() => setLocation("/crm/inbox?status=new")}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">
              {slaBreach} lead{slaBreach !== 1 ? "s" : ""} breached 24h SLA — unactioned &amp; still "New". Click to review in inbox.
            </span>
            <span className="text-xs underline opacity-70">View in inbox →</span>
          </button>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Leads", value: d.totalLeads.toLocaleString("en-IN") },
            { label: "New / Unactioned", value: d.newLeads.toLocaleString("en-IN"), color: "text-blue-600" },
            { label: "In Progress", value: d.inProgressLeads.toLocaleString("en-IN"), color: "text-amber-600" },
            { label: "Fulfilled", value: d.fulfilledLeads.toLocaleString("en-IN"), color: "text-green-600" },
            { label: "SLA Breaches", value: slaBreach, color: slaBreach > 0 ? "text-red-600" : "" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
                <div className={cn("text-2xl font-bold", color ?? "")}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* TTFA + Opt-out + DND cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Timer className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Median Time-to-First-Action</div>
                <div className="text-xl font-bold text-blue-600">{formatTtfa(d.ttfaMedianMinutes)}</div>
                <div className="text-xs text-muted-foreground">from creation to first response</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Opt-out Rate</div>
              <div className="text-2xl font-bold">{d.optOutRate ?? 0}%</div>
              <div className="text-xs text-muted-foreground mt-0.5">of leads have opted out</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">DND Listed</div>
              <div className="text-2xl font-bold">{d.dndRate ?? 0}%</div>
              <div className="text-xs text-muted-foreground mt-0.5">on DND registry</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unified horizontal bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Leads by Channel</CardTitle>
              <p className="text-xs text-muted-foreground">Click a bar to open that channel in the inbox</p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={channelChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 20 }}
                    onClick={data => {
                      const ch = data?.activePayload?.[0]?.payload?.channel;
                      if (ch) setLocation(`/crm/inbox?channel=${ch}`);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="channelLabel" width={68} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val, name) => [val, name === "count" ? "Total" : "Fulfilled"]} />
                    <Legend />
                    <Bar dataKey="count" name="Total" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} barSize={12} />
                    <Bar dataKey="fulfilled" name="Fulfilled" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Conversion rate list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Channel Conversion Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-1">
                {channelChartData.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No data for selected filters</p>
                ) : channelChartData.map(ch => (
                  <button
                    key={ch.channel}
                    className="w-full flex items-center gap-3 group text-left hover:bg-muted/20 rounded p-1 -mx-1 transition-colors"
                    onClick={() => setLocation(`/crm/inbox?channel=${ch.channel}`)}
                  >
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: ch.color }} />
                    <div className="w-20 text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                      {ch.channelLabel}
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(ch.conversionRate, 100)}%`, backgroundColor: ch.color }}
                      />
                    </div>
                    <div className="w-10 text-xs font-medium text-right">{ch.conversionRate}%</div>
                    <div className="w-8 text-xs text-muted-foreground text-right">{ch.count}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Volume trend */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Volume Trend — Last 14 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="fulfilled" name="Fulfilled" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Owner Workload — manager/ap_admin only */}
        {canSeeWorkload && (d.ownerWorkload?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" /> Owner Workload
              </CardTitle>
              <p className="text-xs text-muted-foreground">Lead distribution across team members</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs font-medium">
                      <th className="text-left py-2">Owner</th>
                      <th className="text-right py-2">New</th>
                      <th className="text-right py-2">Contacted</th>
                      <th className="text-right py-2">In Progress</th>
                      <th className="text-right py-2">Fulfilled</th>
                      <th className="text-right py-2">Total</th>
                      <th className="py-2 pl-4 w-28">Mix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {d.ownerWorkload.map(owner => (
                      <tr key={owner.userId} className="hover:bg-muted/20">
                        <td className="py-2.5 font-medium">{owner.name}</td>
                        <td className="py-2.5 text-right text-blue-600 font-medium">{owner.new}</td>
                        <td className="py-2.5 text-right text-amber-600">{owner.contacted}</td>
                        <td className="py-2.5 text-right text-orange-500">{owner.in_progress}</td>
                        <td className="py-2.5 text-right text-green-600">{owner.fulfilled}</td>
                        <td className="py-2.5 text-right font-bold">{owner.total}</td>
                        <td className="py-2.5 pl-4">
                          <div className="flex h-2 rounded-full overflow-hidden w-24">
                            <div className="bg-blue-400" style={{ width: `${owner.total ? (owner.new / owner.total) * 100 : 0}%` }} />
                            <div className="bg-amber-400" style={{ width: `${owner.total ? (owner.contacted / owner.total) * 100 : 0}%` }} />
                            <div className="bg-orange-400" style={{ width: `${owner.total ? (owner.in_progress / owner.total) * 100 : 0}%` }} />
                            <div className="bg-green-400" style={{ width: `${owner.total ? (owner.fulfilled / owner.total) * 100 : 0}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> New</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> Contacted</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-400 inline-block" /> In Progress</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" /> Fulfilled</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
