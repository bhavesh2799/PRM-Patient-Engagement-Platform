import { AppLayout } from "@/components/layout/AppLayout";
import { useGetChannelConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Smartphone, BellRing } from "lucide-react";

export default function Integrations() {
  const { data: config, isLoading } = useGetChannelConfig();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">Loading integrations...</div>
      </AppLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'live': return <Badge className="bg-green-500">Live</Badge>;
      case 'pending': return <Badge variant="secondary">Pending Approval</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="outline">Not Configured</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">Manage your communication channels.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {config?.channels?.map((channel) => (
            <Card key={channel.type}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg capitalize flex items-center gap-2">
                  {channel.type === 'whatsapp' && <MessageSquare className="w-5 h-5" />}
                  {channel.type === 'sms' && <Smartphone className="w-5 h-5" />}
                  {channel.type === 'push' && <BellRing className="w-5 h-5" />}
                  {channel.type}
                </CardTitle>
                {getStatusBadge(channel.status)}
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {channel.type === 'whatsapp' && "WhatsApp Business API Integration"}
                  {channel.type === 'sms' && "Transactional and Promotional SMS"}
                  {channel.type === 'push' && "Mobile App Push Notifications"}
                </CardDescription>
                
                {channel.type === 'whatsapp' && channel.wabaNumbers && channel.wabaNumbers.length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <h4 className="text-sm font-semibold">Active Numbers</h4>
                    {channel.wabaNumbers.map((waba, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="font-mono">{waba.number}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{waba.ownership}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                
                {channel.type === 'sms' && channel.smsHeaders && channel.smsHeaders.length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <h4 className="text-sm font-semibold">Approved Headers</h4>
                    {channel.smsHeaders.map((header, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="font-mono">{header.value}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">{header.ownership}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {channel.type === 'push' && channel.pushWorkspaceId && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <h4 className="text-sm font-semibold">Workspace</h4>
                    <div className="text-sm font-mono truncate">{channel.pushWorkspaceId}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Phase 2 Features */}
        <div className="mt-12 pt-8 border-t">
          <h3 className="text-xl font-semibold mb-4 text-muted-foreground flex items-center gap-2">
            Coming in Phase 2
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-50 pointer-events-none grayscale-[50%]">
            <Card><CardHeader><CardTitle className="text-base">Calling / IVR</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-base">Google / Meta Ads</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-base">HIS Live Integration</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-base">Email Channel</CardTitle></CardHeader></Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
