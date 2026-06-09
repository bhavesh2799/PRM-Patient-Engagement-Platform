import { AppLayout } from "@/components/layout/AppLayout";
import { useListCampaigns, useApproveCampaign, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CampaignsAdmin() {
  const { data: campaigns, isLoading } = useListCampaigns();
  const approveCampaign = useApproveCampaign();
  const queryClient = useQueryClient();

  const handleApprove = (id: number) => {
    approveCampaign.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Campaign approved successfully. It will now launch.");
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        },
        onError: () => {
          toast.error("Failed to approve campaign.");
        }
      }
    );
  };

  const pendingCampaigns = campaigns?.filter(c => c.status === 'submitted') || [];
  const activeCampaigns = campaigns?.filter(c => ['approved', 'live', 'completed', 'paused'].includes(c.status)) || [];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <Badge className="mb-2 bg-purple-500">Super Admin</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaign Oversight</h1>
          <p className="text-muted-foreground mt-1">Review submitted hospital campaigns for compliance before launch.</p>
        </div>

        {pendingCampaigns.length > 0 && (
          <Card className="border-orange-200">
            <CardHeader className="bg-orange-50/50 pb-4 border-b border-orange-100">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <ShieldAlert className="w-5 h-5" /> Requires Approval
              </CardTitle>
              <CardDescription className="text-orange-700/80">These campaigns have been submitted by hospital managers and require final Affordplan sign-off.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Cost Estimate</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCampaigns.map((camp) => (
                    <TableRow key={camp.id}>
                      <TableCell className="font-medium">
                        {camp.name}
                        <div className="text-xs text-muted-foreground mt-1">{camp.goal}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{camp.audienceSegmentName}</div>
                        <div className="text-xs text-muted-foreground">{camp.estimatedRecipients?.toLocaleString() || 0} patients</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">₹{camp.costBreakdown?.total?.toLocaleString() || 0}</div>
                        <div className="text-xs text-muted-foreground flex gap-1 mt-1">
                          {camp.channels?.map(ch => (
                            <Badge key={ch.channel} variant="outline" className="text-[9px] uppercase px-1 py-0">{ch.channel}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{camp.createdByName || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(camp.createdAt), 'PP')}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="text-destructive"><X className="w-4 h-4 mr-1" /> Reject</Button>
                          <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(camp.id)}><Check className="w-4 h-4 mr-1" /> Approve & Launch</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Audience Size</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
                ) : !activeCampaigns.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No active campaigns</TableCell></TableRow>
                ) : (
                  activeCampaigns.map((camp) => (
                    <TableRow key={camp.id}>
                      <TableCell className="font-medium">
                        {camp.name}
                        <div className="text-xs text-muted-foreground mt-1">{camp.goal}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          camp.status === 'live' ? 'default' : 
                          camp.status === 'completed' ? 'secondary' : 
                          camp.status === 'failed' ? 'destructive' : 
                          'outline'
                        } className="capitalize">
                          {camp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{camp.estimatedRecipients?.toLocaleString() || 0}</TableCell>
                      <TableCell>₹{camp.costBreakdown?.total?.toLocaleString() || 0}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(camp.createdAt), 'PP')}</TableCell>
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
