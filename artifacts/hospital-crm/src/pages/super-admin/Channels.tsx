import { AppLayout } from "@/components/layout/AppLayout";
import { useGetChannelConfig, useUpdateChannelConfig, getGetChannelConfigQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Smartphone, BellRing, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Channels() {
  const { data: config, isLoading } = useGetChannelConfig();
  const updateConfig = useUpdateChannelConfig();
  const queryClient = useQueryClient();

  const handleUpdateStatus = (type: 'sms' | 'whatsapp' | 'push', status: 'live' | 'not_configured' | 'pending' | 'error') => {
    if (!config) return;
    const newChannels = config.channels.map(ch => 
      ch.type === type ? { ...ch, status } : ch
    );
    updateConfig.mutate(
      { data: { channels: newChannels } },
      {
        onSuccess: () => {
          toast.success("Channel status updated");
          queryClient.invalidateQueries({ queryKey: getGetChannelConfigQueryKey() });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">Loading channel configuration...</div>
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
          <Badge className="mb-2 bg-purple-500">Super Admin</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Channel Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage underlying provider settings for this hospital.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {config?.channels?.map((channel) => (
            <Card key={channel.type}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded border">
                    {channel.type === 'whatsapp' && <MessageSquare className="w-5 h-5" />}
                    {channel.type === 'sms' && <Smartphone className="w-5 h-5" />}
                    {channel.type === 'push' && <BellRing className="w-5 h-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-lg capitalize">{channel.type}</CardTitle>
                    <CardDescription>
                      {channel.type === 'whatsapp' && "WhatsApp Business API Integration"}
                      {channel.type === 'sms' && "Transactional and Promotional SMS"}
                      {channel.type === 'push' && "Mobile App Push Notifications"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {getStatusBadge(channel.status)}
                  <select 
                    className="text-sm border rounded p-1 bg-background"
                    value={channel.status}
                    onChange={(e) => handleUpdateStatus(channel.type, e.target.value as any)}
                  >
                    <option value="not_configured">Not Configured</option>
                    <option value="pending">Pending</option>
                    <option value="live">Live</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {channel.type === 'whatsapp' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold">WABA Numbers</h4>
                      <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Number</Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Number</TableHead>
                          <TableHead>Ownership</TableHead>
                          <TableHead>Default</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {channel.wabaNumbers?.map((waba, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{waba.number}</TableCell>
                            <TableCell><Badge variant="outline" className="uppercase text-[10px]">{waba.ownership}</Badge></TableCell>
                            <TableCell>{waba.isDefault ? <Badge>Default</Badge> : '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon"><Settings2 className="w-4 h-4" /></Button>
                            </TableCell>
                          </TableRow>
                        )) || <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No numbers configured</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {channel.type === 'sms' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold">SMS Headers (DLT)</h4>
                      <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Header</Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Header</TableHead>
                          <TableHead>Ownership</TableHead>
                          <TableHead>Default</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {channel.smsHeaders?.map((header, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono font-medium">{header.value}</TableCell>
                            <TableCell><Badge variant="outline" className="uppercase text-[10px]">{header.ownership}</Badge></TableCell>
                            <TableCell>{header.isDefault ? <Badge>Default</Badge> : '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon"><Settings2 className="w-4 h-4" /></Button>
                            </TableCell>
                          </TableRow>
                        )) || <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No headers configured</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {channel.type === 'push' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Workspace Configuration</h4>
                    <div className="flex gap-4 items-end">
                      <div className="flex-1 space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Firebase/Push Workspace ID</label>
                        <div className="p-2 bg-muted rounded font-mono text-sm border">{channel.pushWorkspaceId || 'Not configured'}</div>
                      </div>
                      <Button variant="outline">Edit Workspace</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
