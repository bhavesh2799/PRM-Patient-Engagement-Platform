import { AppLayout } from "@/components/layout/AppLayout";
import { useGetCrmDashboard } from "@workspace/api-client-react";
import { getGetCrmDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { AlertTriangle } from "lucide-react";

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp", web_chat: "Web Chat", form: "Web Form",
  csv: "CSV", app_booking: "App", web_booking: "Web", push: "Push",
};

export default function CrmDashboard() {
  const { data: dashboard, isLoading } = useGetCrmDashboard({
    query: { queryKey: getGetCrmDashboardQueryKey() },
  });

  const d = dashboard as any;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }
  if (!d) return null;

  const byChannel: any[] = (d.byChannel ?? []).map((ch: any) => ({
    ...ch,
    channelLabel: CHANNEL_LABELS[ch.channel] ?? ch.channel,
  }));
  const trend: any[] = d.trend ?? [];
  const slaBreach: number = d.slaBreach ?? 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CRM Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Incoming lead performance and SLA tracking.</p>
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
                <div className={`text-3xl font-bold ${color ?? ""}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
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
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byChannel} barCategoryGap="40%">
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
                  <div key={ch.channel} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-muted-foreground truncate">{ch.channelLabel}</div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(ch.conversionRate, 100)}%` }}
                      />
                    </div>
                    <div className="w-12 text-sm font-medium text-right">{ch.conversionRate}%</div>
                  </div>
                ))}
                {byChannel.filter(c => c.count > 0).length === 0 && (
                  <p className="text-muted-foreground text-sm py-4 text-center">No data yet</p>
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
