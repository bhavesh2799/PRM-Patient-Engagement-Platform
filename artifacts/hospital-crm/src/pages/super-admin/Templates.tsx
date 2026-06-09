import { AppLayout } from "@/components/layout/AppLayout";
import { useListTemplateRequests, useUpdateTemplateRequest, useListTemplates, useUpdateTemplate, getListTemplateRequestsQueryKey, getListTemplatesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

export default function TemplatesAdmin() {
  const { data: requests, isLoading: requestsLoading } = useListTemplateRequests();
  const { data: templates, isLoading: templatesLoading } = useListTemplates();
  const updateRequest = useUpdateTemplateRequest();
  const updateTemplate = useUpdateTemplate();
  const queryClient = useQueryClient();

  const handleApproveRequest = (id: number, currentStage: string) => {
    let nextStage: "channel_compliance" | "live" = "channel_compliance";
    if (currentStage === "channel_compliance") nextStage = "live";

    updateRequest.mutate(
      { id, data: { approvalStage: nextStage } },
      {
        onSuccess: () => {
          toast.success("Template request advanced to " + nextStage.replace('_', ' '));
          queryClient.invalidateQueries({ queryKey: getListTemplateRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
        }
      }
    );
  };

  const handleRejectRequest = (id: number) => {
    updateRequest.mutate(
      { id, data: { approvalStage: "rejected", rejectionReason: "Rejected by Affordplan Admin" } },
      {
        onSuccess: () => {
          toast.success("Template request rejected");
          queryClient.invalidateQueries({ queryKey: getListTemplateRequestsQueryKey() });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <Badge className="mb-2 bg-purple-500">Super Admin</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Template Management</h1>
          <p className="text-muted-foreground mt-1">Review and approve hospital template requests and manage compliance.</p>
        </div>

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">Pending Requests</TabsTrigger>
            <TabsTrigger value="active">Active Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Approval Queue</CardTitle>
                <CardDescription>Templates waiting for Affordplan or Channel compliance review.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Channel / Goal</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
                    ) : !requests?.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No pending requests</TableCell></TableRow>
                    ) : (
                      requests.filter(r => r.approvalStage !== 'live').map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">
                            {req.name}
                            <div className="text-xs text-muted-foreground truncate max-w-[250px] mt-1" title={req.message}>{req.message}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 mb-1">
                              <Badge variant="outline" className="uppercase text-[10px]">{req.channel}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">{req.goal}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{req.createdByName || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{format(new Date(req.createdAt), 'PP')}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={req.approvalStage === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">
                              {req.approvalStage.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="icon" title="View details"><Eye className="w-4 h-4" /></Button>
                              {req.approvalStage !== 'rejected' && (
                                <>
                                  <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleRejectRequest(req.id)}><X className="w-4 h-4" /></Button>
                                  <Button variant="default" size="icon" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveRequest(req.id, req.approvalStage)}><Check className="w-4 h-4" /></Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost/Msg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
                    ) : !templates?.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No active templates</TableCell></TableRow>
                    ) : (
                      templates.map((tpl) => (
                        <TableRow key={tpl.id}>
                          <TableCell className="font-medium">
                            {tpl.name}
                            <div className="text-xs text-muted-foreground mt-1">{tpl.goal}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="uppercase text-[10px]">{tpl.channel}</Badge></TableCell>
                          <TableCell className="max-w-[300px]">
                            <div className="text-xs truncate" title={tpl.body}>{tpl.body}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={tpl.status === 'approved' ? 'default' : 'secondary'} className="capitalize">
                              {tpl.status}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{tpl.perMessageCost}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
