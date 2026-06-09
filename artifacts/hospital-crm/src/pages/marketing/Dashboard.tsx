import { AppLayout } from "@/components/layout/AppLayout";
import { useGetEngagementDashboard, useListCampaigns, useGetWallet, usePauseCampaign } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, Pause, MessageCircle, Mail, Globe, MessageSquare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  live: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  paused: "bg-amber-100 text-amber-700",
  submitted: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-600",
  approved: "bg-emerald-100 text-emerald-700",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", waba: "WhatsApp", web_chat: "WhatsApp Chat",
  email: "Email", sms: "SMS", form: "Form",
};

function ChannelIcon({ channel }: { channel: string }) {
  const cls = "w-4 h-4 shrink-0 mx-auto";
  if (channel === "whatsapp" || channel === "waba") return <MessageCircle className={`${cls} text-green-600`} />;
  if (channel === "email") return <Mail className={`${cls} text-blue-500`} />;
  if (channel === "web_chat") return <Globe className={`${cls} text-teal-500`} />;
  return <MessageSquare className={`${cls} text-gray-500`} />;
}

export default function MarketingDashboard() {
  const [, navigate] = useLocation();
  const { data: dashboard, isLoading } = useGetEngagementDashboard();
  const { data: campaigns } = useListCampaigns();
  const { data: wallet } = useGetWallet();
  const pauseMutation = usePauseCampaign();
  const queryClient = useQueryClient();

  const isLowBalance = wallet && (wallet.balance as number) < 5000;
  const d = dashboard as any;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">Loading…</div>
      </AppLayout>
    );
  }
  if (!d) return null;

  const recentCampaigns: any[] = d.recentCampaigns ?? (campaigns ?? []).slice(0, 5);

  const patientsReached: number = d.patientsReachedMtd ?? 0;
  const deliveryRate: number = d.deliveryRate ?? 0;
  const totalConversions: number = d.totalConversions ?? 0;
  const activeCampaigns: number = d.activeCampaigns ?? 0;
  const totalSpend: number = d.totalSpend ?? 0;
  const totalRevenue: number = d.totalRevenue ?? 0;
  const roi: number = d.roi ?? 0;

  const channelPerf: any[] = d.channelPerformance ?? [];
  const maxReached = Math.max(...channelPerf.map((c: any) => c.reached ?? 0), 1);

  const handlePause = (id: number) => {
    pauseMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        queryClient.invalidateQueries({ queryKey: ["engagementDashboard"] });
      },
    });
  };

  function formatRevenue(n: number): string {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
    return `₹${n.toLocaleString("en-IN")}`;
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Marketing Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Outbound campaign performance and patient engagement.</p>
        </div>

        {/* Low balance alert */}
        {isLowBalance && (
          <div className="flex items-center gap-3 p-3.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Wallet balance ₹{(wallet?.balance as number).toLocaleString("en-IN")} is below ₹5,000. <button className="underline font-medium" onClick={() => navigate("/settings/wallet")}>Top up →</button></span>
          </div>
        )}

        {/* ── OUTREACH ─────────────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Outreach (Month to Date)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="cursor-pointer hover:border-blue-200 transition-colors" onClick={() => navigate("/marketing/campaigns")}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Patients Reached</p>
                <p className="text-3xl font-bold text-blue-600">{patientsReached.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1">{activeCampaigns} active campaign{activeCampaigns !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-green-200 transition-colors">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Avg Delivery Rate</p>
                <p className="text-3xl font-bold text-green-600">{deliveryRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">Across all channels</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/marketing/campaigns")}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Conversions</p>
                <p className="text-3xl font-bold text-green-600">{totalConversions.toLocaleString("en-IN")}</p>
                <p className="text-xs text-green-600 mt-1 hover:underline">View campaigns →</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/marketing/campaigns")}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Active Campaigns</p>
                <p className="text-3xl font-bold">{activeCampaigns}</p>
                <p className="text-xs text-muted-foreground mt-1">Running now</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── ROI ─────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Return on Investment
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/settings/wallet")}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Total Spend</p>
                <p className="text-2xl font-bold">₹{totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-1">Campaign costs + fees + GST</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-foreground/30 transition-colors">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Revenue Attributed</p>
                <p className="text-2xl font-bold">{formatRevenue(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">From UHID-matched bookings</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-green-200 transition-colors">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">ROI</p>
                <p className={`text-2xl font-bold ${roi > 0 ? "text-green-600" : roi < 0 ? "text-red-500" : ""}`}>{roi}%</p>
                <p className="text-xs text-muted-foreground mt-1">Revenue / Spend</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── CHARTS ROW ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Channel performance */}
          {channelPerf.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base font-semibold">Channel Performance</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Patients reached by channel this month</p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-2 mt-1">
                  {channelPerf.map((ch: any) => (
                    <div key={ch.channel} className="flex items-center gap-2 text-sm py-0.5">
                      <span className="w-28 text-xs text-muted-foreground truncate shrink-0">
                        {CHANNEL_LABELS[ch.channel] ?? ch.channel}
                      </span>
                      <div className="flex-1 h-[10px] bg-muted/30 rounded-sm overflow-hidden">
                        <div
                          className="h-full rounded-sm"
                          style={{ width: `${(ch.reached / maxReached) * 100}%`, backgroundColor: "hsl(var(--primary) / 0.65)" }}
                        />
                      </div>
                      <span className="w-10 text-xs font-medium text-right shrink-0">{ch.reached?.toLocaleString("en-IN") ?? 0}</span>
                      <span className="w-12 text-right shrink-0 text-xs text-green-600 font-medium">
                        {ch.deliveryRate > 0 ? `${ch.deliveryRate}%` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent campaigns mini-table */}
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Campaigns</CardTitle>
                <button className="text-xs text-blue-600 hover:underline shrink-0" onClick={() => navigate("/marketing/campaigns")}>
                  View all →
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Latest activity · sorted by recency</p>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {recentCampaigns.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No campaigns yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left font-medium py-2 px-3">Campaign</th>
                      <th className="text-center font-medium py-2 px-2 w-8">Ch</th>
                      <th className="text-right font-medium py-2 px-2">Sent</th>
                      <th className="text-right font-medium py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCampaigns.slice(0, 6).map((c: any) => (
                      <tr
                        key={c.id}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate(`/marketing/metrics?campaign=${c.id}`)}
                      >
                        <td className="py-2 px-3 font-medium text-xs max-w-[130px] truncate">{c.name}</td>
                        <td className="py-2 px-2 text-center">
                          <ChannelIcon channel={c.channel ?? (c.channels?.[0]?.channel ?? "")} />
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                          {(c.sent ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
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

      </div>
    </AppLayout>
  );
}
