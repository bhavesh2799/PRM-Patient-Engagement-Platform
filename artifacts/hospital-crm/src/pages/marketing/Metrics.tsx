import { AppLayout } from "@/components/layout/AppLayout";
import { useListCampaigns, useGetCampaignMetrics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart as BarChartIcon } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Metrics() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const { data: campaigns } = useListCampaigns();
  const { data: metrics, isLoading } = useGetCampaignMetrics(selectedId as number, { 
    query: { enabled: !!selectedId, queryKey: ['getCampaignMetrics', selectedId] } 
  });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaign Metrics</h1>
            <p className="text-muted-foreground mt-1">Detailed funnel analysis for your campaigns.</p>
          </div>
          <select 
            className="h-10 px-3 rounded-md border min-w-[250px]"
            value={selectedId || ""}
            onChange={e => setSelectedId(Number(e.target.value))}
          >
            <option value="" disabled>Select a campaign...</option>
            {campaigns?.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </select>
        </div>

        {!selectedId ? (
          <Card className="flex items-center justify-center py-24">
            <CardContent className="text-center flex flex-col items-center">
              <BarChartIcon className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-medium mb-2">Select a Campaign to Analyze</h3>
              <p className="text-muted-foreground">Metrics will appear here once a campaign is selected.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card className="py-24"><CardContent className="text-center">Loading metrics...</CardContent></Card>
        ) : metrics ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Sent</div>
                <div className="text-3xl font-bold">{metrics.sent?.toLocaleString() || 0}</div>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Delivered</div>
                <div className="text-3xl font-bold text-blue-600">{metrics.delivered?.toLocaleString() || 0}</div>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Clicked</div>
                <div className="text-3xl font-bold text-orange-500">{metrics.clicked?.toLocaleString() || 0}</div>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Converted</div>
                <div className="text-3xl font-bold text-green-600">{metrics.converted?.toLocaleString() || 0}</div>
              </CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Funnel Visualization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { stage: 'Sent', count: metrics.sent || 0 },
                      { stage: 'Delivered', count: metrics.delivered || 0 },
                      { stage: 'Opened', count: metrics.opened || 0 },
                      { stage: 'Clicked', count: metrics.clicked || 0 },
                      { stage: 'Converted', count: metrics.converted || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip cursor={{fill: 'var(--accent)'}} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card><CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Total Spend</div>
                <div className="text-3xl font-bold">₹{metrics.spend?.toLocaleString() || 0}</div>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">Revenue Attributed</div>
                <div className="text-3xl font-bold text-primary">₹{metrics.revenueAttributed?.toLocaleString() || 0}</div>
              </CardContent></Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">No metrics available yet</div>
        )}
      </div>
    </AppLayout>
  );
}