import { AppLayout } from "@/components/layout/AppLayout";
import { useListTemplates, useListTemplateRequests, useCreateTemplateRequest, getListTemplateRequestsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function Templates() {
  const { data: templates, isLoading: templatesLoading } = useListTemplates();
  const { data: requests, isLoading: requestsLoading } = useListTemplateRequests();
  const createRequest = useCreateTemplateRequest();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    channel: "whatsapp" as any,
    goal: "Appointment Reminder",
    message: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRequest.mutate(
      { data: formData },
      {
        onSuccess: () => {
          toast.success("Template request submitted");
          setIsDialogOpen(false);
          setFormData({ name: "", channel: "whatsapp", goal: "Appointment Reminder", message: "" });
          queryClient.invalidateQueries({ queryKey: getListTemplateRequestsQueryKey() });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Templates</h1>
            <p className="text-muted-foreground mt-1">Manage message templates for WhatsApp, SMS, and Push.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Request New Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request New Template</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template Name</label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Follow-up 1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Channel</label>
                    <select className="w-full h-10 px-3 rounded-md border" value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value as any})}>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="push">Push Notification</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Goal</label>
                    <Input required value={formData.goal} onChange={e => setFormData({...formData, goal: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message Body</label>
                  <Textarea required value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} rows={5} placeholder="Dear {{name}}, your appointment is confirmed..." />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={createRequest.isPending}>
                    {createRequest.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Template Library</TabsTrigger>
            <TabsTrigger value="requests">Requests & Approvals</TabsTrigger>
          </TabsList>
          
          <TabsContent value="library" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templatesLoading ? (
                <div className="col-span-full text-center py-8">Loading templates...</div>
              ) : !templates?.length ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">No templates found</div>
              ) : (
                templates.map(template => (
                  <Card key={template.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="uppercase text-xs">{template.channel}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{template.goal} • {template.language}</div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-wrap">
                        {template.body}
                      </div>
                      <div className="mt-4 flex justify-between items-center text-xs">
                        <Badge variant={template.status === 'approved' ? 'default' : 'secondary'}>
                          {template.status}
                        </Badge>
                        <span className="text-muted-foreground">₹{template.perMessageCost}/msg</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {requestsLoading ? (
                  <div className="text-center py-8">Loading requests...</div>
                ) : !requests?.length ? (
                  <div className="text-center py-8 text-muted-foreground">No template requests found</div>
                ) : (
                  <div className="divide-y">
                    {requests.map(req => (
                      <div key={req.id} className="p-4 flex justify-between items-center">
                        <div>
                          <div className="font-medium">{req.name}</div>
                          <div className="text-sm text-muted-foreground">{req.channel} • {req.goal}</div>
                          <div className="text-xs text-muted-foreground mt-1">{format(new Date(req.createdAt), 'PP')}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={req.approvalStage === 'rejected' ? 'destructive' : req.approvalStage === 'live' ? 'default' : 'outline'}>
                            {req.approvalStage.replace('_', ' ')}
                          </Badge>
                          {req.rejectionReason && <div className="text-xs text-destructive">{req.rejectionReason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}