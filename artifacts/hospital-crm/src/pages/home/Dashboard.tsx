import { AppLayout } from "@/components/layout/AppLayout";
import { useGetHomeDashboard } from "@workspace/api-client-react";
import { getGetHomeDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { TrendingUp, Users, Calendar, CheckCircle } from "lucide-react";

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

export default function HomeDashboard() {
  const { data: dashboard, isLoading } = useGetHomeDashboard({
    query: { queryKey: getGetHomeDashboardQueryKey() },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          Loading dashboard...
        </div>
      </AppLayout>
    );
  }

  if (!dashboard) return null;

  const appt = (dashboard as any).appointmentSummary ?? {};
  const leadsByChannel: Array<{ channel: string; count: number }> = (dashboard as any).leadsByChannel ?? [];
  const funnel: Array<{ status: string; count: number }> = (dashboard as any).funnel ?? [];
  const trend: Array<{ date: string; count: number }> = (dashboard as any).trend ?? [];
  const recentLeads: any[] = (dashboard as any).recentLeads ?? [];
  const totalLeads: number = (dashboard as any).totalLeads ?? 0;
  const newLeads: number = (dashboard as any).newLeads ?? 0;
  const convertedLeads: number = (dashboard as any).convertedLeads ?? 0;

  const channelChartData = leadsByChannel.map(d => ({
    channel: CHANNEL_LABELS[d.channel] ?? d.channel,
    count: d.count,
  }));

  const funnelChartData = funnel.map(d => ({
    stage: d.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
    count: d.count,
  }));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Command Center</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live overview of all hospital incoming and outgoing engagements.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
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
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">New (Unactioned)</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-600" data-testid="stat-new-leads">
                {newLeads.toLocaleString("en-IN")}
              </div>
            </CardContent>
          </Card>
          <Card>
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
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">Fulfilled</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-green-600" data-testid="stat-converted">
                {convertedLeads.toLocaleString("en-IN")}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads by Channel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Leads by Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelChartData} barCategoryGap="40%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip cursor={{ fill: "hsl(var(--accent))" }} />
                    <Bar
                      dataKey="count"
                      name="Leads"
                      fill="hsl(var(--primary))"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Lead Lifecycle Funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Lead Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChartData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Leads"
                      fill="hsl(var(--chart-2))"
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
              <div className="h-52">
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

        {/* Appointment Summary strip */}
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
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
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
                {recentLeads.map((lead: any) => (
                  <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
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
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {lead.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {lead.ownerName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm pr-6">
                      {format(new Date(lead.createdAt), "dd MMM, h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
                {recentLeads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No leads yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
