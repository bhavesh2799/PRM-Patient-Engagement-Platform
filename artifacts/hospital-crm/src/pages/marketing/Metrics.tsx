import { AppLayout } from "@/components/layout/AppLayout";
import { useListCampaigns, useGetCampaignMetrics, useGetWallet } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart as BarChartIcon, TrendingUp, IndianRupee } from "lucide-react";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

function LowWalletBanner({ balance }: { balance?: number }) {
  if (balance === undefined || balance >= 5000) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      Wallet balance ₹{parseFloat(String(balance)).toLocaleString("en-IN")} is below ₹5,000. Top up to avoid campaign interruptions.
    </div>
  );
}

export default function Metrics() {
  const search = useSearch();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: campaigns } = useListCampaigns();
  const { data: wallet } = useGetWallet();
  const { data: metrics, isLoading } = useGetCampaignMetrics(selectedId as number, {
    query: { enabled: !!selectedId, queryKey: ["getCampaignMetrics", selectedId] },
  });

  // Pre-select from URL param (e.g. from Campaigns page "View Metrics" link)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get("campaign");
    if (id) setSelectedId(Number(id));
  }, [search]);

  const selectedCampaign = campaigns?.find(c => c.id === selectedId);

  // Derived metrics
  const deliveryRate = metrics?.sent ? ((metrics.delivered ?? 0) / metrics.sent) * 100 : null;
  const openRate = metrics?.delivered ? ((metrics.opened ?? 0) / (metrics.delivered ?? 1)) * 100 : null;
  const clickRate = metrics?.delivered ? ((metrics.clicked ?? 0) / (metrics.delivered ?? 1)) * 100 : null;
  const convRate = metrics?.sent ? ((metrics.converted ?? 0) / metrics.sent) * 100 : null;
  const costPerConversion =
    metrics?.spend && metrics.converted && metrics.converted > 0
      ? metrics.spend / metrics.converted
      : null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <LowWalletBanner balance={wallet ? parseFloat(String(wallet.balance)) : undefined} />

        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaign Metrics</h1>
            <p className="text-muted-foreground mt-1">Funnel analysis and cost efficiency per campaign.</p>
          </div>
          <select
            className="h-10 px-3 rounded-md border min-w-[260px] bg-background text-sm"
            value={selectedId || ""}
            onChange={e => setSelectedId(Number(e.target.value))}
          >
            <option value="" disabled>Select a campaign…</option>
            {campaigns?.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </select>
        </div>

        {!selectedId ? (
          <Card className="flex items-center justify-center py-24">
            <CardContent className="text-center flex flex-col items-center">
              <BarChartIcon className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-medium mb-2">Select a Campaign to Analyse</h3>
              <p className="text-muted-foreground">Delivery, engagement, and cost metrics will appear here.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card className="py-24"><CardContent className="text-center">Loading metrics…</CardContent></Card>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Campaign header */}
            {selectedCampaign && (
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">{selectedCampaign.name}</h2>
                <Badge variant="secondary" className="capitalize">{selectedCampaign.status}</Badge>
                <Badge variant="outline">{selectedCampaign.goal}</Badge>
              </div>
            )}

            {/* Funnel counts */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card><CardContent className="p-5">
                <div className="text-xs font-medium text-muted-foreground mb-1">Sent</div>
                <div className="text-2xl font-bold">{(metrics.sent ?? 0).toLocaleString("en-IN")}</div>
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs font-medium text-muted-foreground mb-1">Delivered</div>
                <div className="text-2xl font-bold text-blue-600">{(metrics.delivered ?? 0).toLocaleString("en-IN")}</div>
                {deliveryRate !== null && <div className="text-xs text-muted-foreground mt-0.5">{deliveryRate.toFixed(1)}% delivery</div>}
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs font-medium text-muted-foreground mb-1">Opened</div>
                <div className="text-2xl font-bold text-violet-600">{(metrics.opened ?? 0).toLocaleString("en-IN")}</div>
                {openRate !== null && <div className="text-xs text-muted-foreground mt-0.5">{openRate.toFixed(1)}% open rate</div>}
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs font-medium text-muted-foreground mb-1">Clicked</div>
                <div className="text-2xl font-bold text-orange-500">{(metrics.clicked ?? 0).toLocaleString("en-IN")}</div>
                {clickRate !== null && <div className="text-xs text-muted-foreground mt-0.5">{clickRate.toFixed(1)}% CTR</div>}
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <div className="text-xs font-medium text-muted-foreground mb-1">Converted</div>
                <div className="text-2xl font-bold text-green-600">{(metrics.converted ?? 0).toLocaleString("en-IN")}</div>
                {convRate !== null && <div className="text-xs text-muted-foreground mt-0.5">{convRate.toFixed(2)}% conv. rate</div>}
              </CardContent></Card>
            </div>

            {/* Cost & efficiency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardContent className="p-5 flex items-start gap-3">
                <IndianRupee className="w-8 h-8 text-muted-foreground mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Total Spend</div>
                  <div className="text-2xl font-bold">₹{(metrics.spend ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-5 flex items-start gap-3">
                <TrendingUp className="w-8 h-8 text-green-600 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Revenue Attributed</div>
                  <div className="text-2xl font-bold text-primary">₹{(metrics.revenueAttributed ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                  {metrics.spend && metrics.revenueAttributed && metrics.spend > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {(metrics.revenueAttributed / metrics.spend).toFixed(1)}× ROAS
                    </div>
                  )}
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-5 flex items-start gap-3">
                <BarChartIcon className="w-8 h-8 text-orange-500 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Cost per Conversion</div>
                  {costPerConversion !== null ? (
                    <div className="text-2xl font-bold">
                      ₹{costPerConversion.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                  )}
                  {convRate !== null && (
                    <div className="text-xs text-muted-foreground mt-0.5">{convRate.toFixed(2)}% conversion rate</div>
                  )}
                </div>
              </CardContent></Card>
            </div>

            {/* Funnel chart */}
            <Card>
              <CardHeader>
                <CardTitle>Funnel Visualisation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { stage: "Sent", count: metrics.sent ?? 0 },
                      { stage: "Delivered", count: metrics.delivered ?? 0 },
                      { stage: "Opened", count: metrics.opened ?? 0 },
                      { stage: "Clicked", count: metrics.clicked ?? 0 },
                      { stage: "Converted", count: metrics.converted ?? 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip cursor={{ fill: "var(--accent)" }} formatter={(v: number) => v.toLocaleString("en-IN")} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Rate breakdown */}
            <Card>
              <CardHeader><CardTitle>Rate Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: "Delivery Rate", value: deliveryRate, color: "text-blue-600" },
                    { label: "Open Rate", value: openRate, color: "text-violet-600" },
                    { label: "Click-through Rate", value: clickRate, color: "text-orange-500" },
                    { label: "Conversion Rate", value: convRate, color: "text-green-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
                      {value !== null ? (
                        <div className={`text-2xl font-bold ${color}`}>{value.toFixed(1)}%</div>
                      ) : (
                        <div className="text-2xl font-bold text-muted-foreground">—</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">No metrics available yet for this campaign.</div>
        )}
      </div>
    </AppLayout>
  );
}
