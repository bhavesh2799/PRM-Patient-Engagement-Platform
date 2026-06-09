import { AppLayout } from "@/components/layout/AppLayout";
import { useGetEngagementDashboard, useListCampaigns, useGetWallet, usePauseCampaign } from "@workspace/api-client-react";
import { getGetEngagementDashboardQueryKey, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { AlertTriangle, Pause } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_BADGE: Record<string, string> = {
  live: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-700",
  paused: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-emerald-100 text-emerald-800",
};

export default function MarketingDashboard() {
  const { data: dashboard, isLoading } = useGetEngagementDashboard({
    query: { queryKey: getGetEngagementDashboardQueryKey() },
  });
  const { data: campaigns } = useListCampaigns({
    query: { queryKey: getListCampaignsQueryKey() },
  });
  const { data: wallet } = useGetWallet();
  const pauseMutation = usePauseCampaign();
  const queryClient = useQueryClient();

  const isLowBalance = wallet && wallet.balance < 5000;

  const d = dashboard as any;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }
  if (!d) return null;

  const recentCampaigns: any[] = d.recentCampaigns ?? campaigns?.slice(0, 5) ?? [];

  const handlePause = (id: number) => {
    pauseMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEngagementDashboardQueryKey() });
      },
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Marketing Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Outbound campaign performance and patient engagement.</p>
        </div>

        {isLowBalance && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">
              Wallet balance ₹{wallet?.balance.toLocaleString("en-IN")} is below ₹5,000. Top up to avoid campaign interruptions.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Patients Reached (MTD)", value: (d.patientsReachedMtd ?? 0).toLocaleString("en-IN") },
            { label: "Delivery Rate", value: `${d.deliveryRate ?? 0}%`, color: "text-primary" },
            { label: "Total Conversions", value: (d.totalConversions ?? 0).toLocaleString("en-IN"), color: "text-green-600" },
            { label: "Active Campaigns", value: d.activeCampaigns ?? 0 },
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Total Spend", value: `₹${(d.totalSpend ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
            { label: "Revenue Attributed", value: `₹${(d.totalRevenue ?? 0).toLocaleString("en-IN")}` },
            { label: "ROI", value: `${d.roi ?? 0}%`, color: (d.roi ?? 0) > 0 ? "text-green-600" : "text-red-500" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
                <div className={`text-2xl font-bold ${color ?? ""}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Campaign</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Converted</TableHead>
                  <TableHead>Spend</TableHead>
                  <TableHead className="pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No campaigns yet</TableCell>
                  </TableRow>
                ) : (
                  recentCampaigns.map((c: any) => (
                    <TableRow key={c.id} data-testid={`row-campaign-${c.id}`}>
                      <TableCell className="pl-6 font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.goal}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell>{(c.sent ?? 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-green-600">{(c.converted ?? 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>₹{(c.spend ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="pr-6">
                        {c.status === "live" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            data-testid={`button-pause-${c.id}`}
                            onClick={() => handlePause(c.id)}
                            disabled={pauseMutation.isPending}
                          >
                            <Pause className="w-3 h-3" />
                            Pause
                          </Button>
                        )}
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
