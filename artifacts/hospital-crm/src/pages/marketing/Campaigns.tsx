import { AppLayout } from "@/components/layout/AppLayout";
import { useListCampaigns, useCreateCampaign, useUpdateCampaign, useSubmitCampaign, usePauseCampaign, useListSegments, useListTemplates, useGetWallet, getListCampaignsQueryKey, useGetSessionRole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Play, Pause, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Campaigns() {
  const { data: campaigns, isLoading } = useListCampaigns();
  const { data: segments } = useListSegments();
  const { data: templates } = useListTemplates();
  const { data: wallet } = useGetWallet();
  const { data: session } = useGetSessionRole();
  const queryClient = useQueryClient();
  
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const submitCampaign = useSubmitCampaign();
  const pauseCampaign = usePauseCampaign();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [newCampaignId, setNewCampaignId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    goal: "Promotional",
    audienceSegmentId: 0,
    channels: [] as any[]
  });

  const handleCreate = () => {
    if (!formData.name || !formData.audienceSegmentId) {
      toast.error("Please fill required fields");
      return;
    }
    
    createCampaign.mutate(
      { data: {
        name: formData.name,
        goal: formData.goal,
        audienceSegmentId: formData.audienceSegmentId,
        channels: formData.channels
      }},
      {
        onSuccess: (res) => {
          setNewCampaignId(res.id);
          setStep(2);
        }
      }
    );
  };

  const handleUpdateChannels = () => {
    if (!newCampaignId) return;
    if (formData.channels.length === 0) {
      toast.error("Please add at least one channel");
      return;
    }
    updateCampaign.mutate(
      { id: newCampaignId, data: { channels: formData.channels } },
      {
        onSuccess: () => {
          setStep(3);
        }
      }
    );
  };

  const handleSubmit = () => {
    if (!newCampaignId) return;
    submitCampaign.mutate(
      { id: newCampaignId },
      {
        onSuccess: () => {
          toast.success("Campaign submitted for approval");
          setIsWizardOpen(false);
          setStep(1);
          setNewCampaignId(null);
          setFormData({ name: "", goal: "Promotional", audienceSegmentId: 0, channels: [] });
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        }
      }
    );
  };

  const handlePause = (id: number) => {
    pauseCampaign.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Campaign paused");
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Manage outbound marketing campaigns.</p>
          </div>
          
          {session?.role !== 'exec' && (
            <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> New Campaign</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Campaign - Step {step} of 3</DialogTitle>
                </DialogHeader>
                
                {step === 1 && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Campaign Name</label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Diwali Checkup Drive" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Goal</label>
                      <select 
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        value={formData.goal}
                        onChange={e => setFormData({...formData, goal: e.target.value})}
                      >
                        <option value="Appointment Reminder">Appointment Reminder</option>
                        <option value="Win-back">Win-back</option>
                        <option value="Promotional">Promotional</option>
                        <option value="Chronic Care">Chronic Care</option>
                        <option value="Feedback">Feedback</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Audience Segment</label>
                      <select 
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        value={formData.audienceSegmentId || ""}
                        onChange={e => setFormData({...formData, audienceSegmentId: Number(e.target.value)})}
                      >
                        <option value="" disabled>Select a segment</option>
                        {segments?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.count} patients)</option>)}
                      </select>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button onClick={handleCreate} disabled={createCampaign.isPending}>Next</Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Add Channels</label>
                      <div className="grid gap-4 border p-4 rounded-md">
                        {['whatsapp', 'sms', 'push'].map(ch => {
                          const isSelected = formData.channels.some(c => c.channel === ch);
                          return (
                            <div key={ch} className="flex items-center gap-4">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({...formData, channels: [...formData.channels, { channel: ch, templateId: 0 }]});
                                  } else {
                                    setFormData({...formData, channels: formData.channels.filter(c => c.channel !== ch)});
                                  }
                                }}
                              />
                              <span className="capitalize w-24 font-medium">{ch}</span>
                              {isSelected && (
                                <select 
                                  className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
                                  value={formData.channels.find(c => c.channel === ch)?.templateId || 0}
                                  onChange={e => {
                                    const tId = Number(e.target.value);
                                    const template = templates?.find(t => t.id === tId);
                                    if(template) {
                                      setFormData({
                                        ...formData, 
                                        channels: formData.channels.map(c => c.channel === ch ? { ...c, templateId: tId, perMessageCost: template.perMessageCost } : c)
                                      });
                                    }
                                  }}
                                >
                                  <option value={0} disabled>Select template</option>
                                  {templates?.filter(t => t.channel === ch && t.status === 'approved').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-end pt-4 gap-2">
                      <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                      <Button onClick={handleUpdateChannels} disabled={updateCampaign.isPending}>Review & Costs</Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4 py-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Cost Estimate</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Base Cost</span>
                          <span>₹{(formData.channels.length * 500).toLocaleString()} (est)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Platform Fee (5%)</span>
                          <span>₹{(formData.channels.length * 25).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST (18%)</span>
                          <span>₹{(formData.channels.length * 94.5).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t mt-2">
                          <span>Total</span>
                          <span>₹{(formData.channels.length * 619.5).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded text-sm">
                      <span>Wallet Balance: ₹{wallet?.balance.toLocaleString()}</span>
                      {wallet && wallet.balance < (formData.channels.length * 619.5) && (
                        <span className="flex items-center gap-1 font-medium"><AlertCircle className="w-4 h-4"/> Insufficient Funds</span>
                      )}
                    </div>
                    <div className="flex justify-end pt-4 gap-2">
                      <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                      <Button onClick={handleSubmit} disabled={submitCampaign.isPending}>Submit for Approval</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost Estimate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4">Loading...</TableCell></TableRow>
                ) : !campaigns?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No campaigns found</TableCell></TableRow>
                ) : (
                  campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="font-medium">{campaign.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>{campaign.goal}</TableCell>
                      <TableCell>{campaign.audienceSegmentName}</TableCell>
                      <TableCell>
                        <Badge variant={
                          campaign.status === 'live' ? 'default' : 
                          campaign.status === 'completed' ? 'secondary' : 
                          campaign.status === 'failed' ? 'destructive' : 
                          'outline'
                        } className="capitalize">
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {campaign.costBreakdown ? `₹${(campaign.costBreakdown.total ?? 0).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.status === 'live' && session?.role !== 'exec' && (
                          <Button variant="ghost" size="sm" onClick={() => handlePause(campaign.id)}>
                            <Pause className="w-4 h-4 text-orange-500" />
                          </Button>
                        )}
                        {campaign.status === 'paused' && session?.role !== 'exec' && (
                          <Button variant="ghost" size="sm" title="Resume via approval">
                            <Play className="w-4 h-4 text-green-500" />
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