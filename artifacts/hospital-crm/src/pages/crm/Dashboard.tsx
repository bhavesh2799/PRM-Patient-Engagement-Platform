import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCrmDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { AlertTriangle, Filter } from "lucide-react";
import { useLocation } from "wouter";

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp", web_chat: "Web Chat", form: "Web Form",
  csv: "CSV", app_booking: "App", web_booking: "Web", push: "Push",
};

const ALL_CHANNELS = ["all", "waba", "web_chat", "form", "csv", "app_booking", "web_booking", "push"];

export default function CrmDashboard() {
  const [channelFilter, setChannelFilter] = useState("all");
  const [, setLocation] = useLocation();

  const { data: dashboard, isLoading } = useGetCrmDashboard();

  const d = dashboard as any;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }
  if (!d) return null;

  const allByChannel: any[] = (d.byChannel ?? []).map((ch: any) => ({
    ...ch,
    channelLabel: CHANNEL_LABELS[ch.channel] ?? ch.channel,
  }));

  const byChannel = channelFilter === "all"
    ? allByChannel
    : allByChannel.filter(c => c.channel === channelFilter);

  const trend: any[] = d.trend ?? [];
  const slaBreach: number = d.slaBreach ?? 0;

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.channel) {
      setLocation(`/crm/inbox?channel=${data.activePayload[0].payload.channel}`);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CRM Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Incoming lead performance and SLA tracking.</p>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filter by channel:</span>
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1 bg-background"
          >
            {ALL_CHANNELS.map(c => (
              <option key={c} value={c}>
                {c === "all" ? "All channels" : CHANNEL_LABELS[c] ?? c}
              </option>
            ))}
          </select>
          {channelFilter !== "all" && (
            <button
              onClick={() => setChannelFilter("all")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>

        {slaBreach > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">
              {slaBreach} lead{slaBreach !== 1 ? "s" : ""} have breached SLA (no action in 24h).
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Leads", value: (d.totalLeads ?? 0).toLocaleString("en-IN") },
            { label: "New (Unactioned)", value: (d.newLeads ?? 0).toLocaleString("en-IN"), color: "text-blue-600" },
            { label: "Fulfilled", value: (d.fulfilledLeads ?? 0).toLocaleString("en-IN"), color: "text-green-600" },
            { label: "SLA Breaches", value: slaBreach, color: slaBreach > 0 ? "text-red-600" : "" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
                <div className={`text-3xl font-bold ${color ?? ""}`}>
                  {value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Leads by Channel</CardTitle>
              <p className="text-xs text-muted-foreground">Click a bar to view leads in inbox</p>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byChannel} barCategoryGap="40%" onClick={handleBarClick} style={{ cursor: "pointer" }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="channelLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="fulfilled" name="Fulfilled" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Channel Conversion Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-2">
                {byChannel.filter(c => c.count > 0).map((ch: any) => (
                  <div
                    key={ch.channel}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => setLocation(`/crm/inbox?channel=${ch.channel}`)}
                  >
                    <div className="w-24 text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">{ch.channelLabel}</div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(ch.conversionRate, 100)}%` }}
                      />
                    </div>
                    <div className="w-12 text-sm font-medium text-right">{ch.conversionRate}%</div>
                  </div>
                ))}
                {byChannel.filter(c => c.count > 0).length === 0 && (
                  <p className="text-muted-foreground text-sm py-4 text-center">No data for selected channel</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Volume Trend — Last 14 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
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

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="text-sm font-medium text-muted-foreground mb-1">Opt-out Rate</div>
              <div className="text-2xl font-bold">{d.optOutRate ?? 0}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-sm font-medium text-muted-foreground mb-1">Closed Leads</div>
              <div className="text-2xl font-bold text-muted-foreground">{d.closedLeads ?? 0}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
