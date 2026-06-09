import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListCampaigns, useCreateCampaign, useUpdateCampaign, useSubmitCampaign,
  usePauseCampaign, useApproveCampaign, useListSegments, useListTemplates,
  useGetWallet, useGetSessionRole,
  getListCampaignsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus, Pause, AlertCircle, CheckCircle2, XCircle, BarChart2, AlertTriangle,
  MessageSquare, Smartphone, Bell,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSearch, useLocation } from "wouter";

const GOALS = ["Appointment Reminder", "Win-back", "Promotional Offer", "Chronic Care", "Feedback"] as const;

const STATUS_COLORS: Record<string, string> = {
  live: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "whatsapp") return <MessageSquare size={12} className="text-green-600" />;
  if (channel === "sms") return <Smartphone size={12} className="text-blue-600" />;
  return <Bell size={12} className="text-orange-500" />;
}

// Channel-styled mini preview
function MiniPreview({ channel, body }: { channel: string; body: string }) {
  const sample = body
    .replace(/\{first_name\}/g, "Priya")
    .replace(/\{doctor_name\}/g, "Dr. Ananya")
    .replace(/\{appointment_date\}/g, "Mon 16 Jun")
    .replace(/\{([^}]+)\}/g, "[$1]")
    .replace(/\{\{([^}|]+)\|"([^"]+)"\}\}/g, "$2");

  if (channel === "sms") {
    return (
      <div className="bg-gray-100 rounded-lg p-2 text-[11px]">
        <div className="text-gray-400 text-[10px] mb-1">SUNRSE</div>
        <div className="bg-white rounded p-2 text-gray-700 line-clamp-3">{sample}</div>
      </div>
    );
  }
  if (channel === "whatsapp") {
    return (
      <div className="bg-[#ECE5DD] rounded-lg p-2 text-[11px]">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-white text-[8px] font-bold">S</div>
          <span className="text-gray-500 text-[10px]">Sunrise Hospital</span>
        </div>
        <div className="bg-white rounded rounded-tl-none p-2 text-gray-700 line-clamp-3 whitespace-pre-line">{sample}</div>
      </div>
    );
  }
  return (
    <div className="bg-gray-800 rounded-lg p-2 text-[11px]">
      <div className="flex items-start gap-1.5">
        <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">S</div>
        <div>
          <div className="text-gray-300 text-[10px]">Sunrise Hospital</div>
          <div className="text-white line-clamp-2">{sample}</div>
        </div>
      </div>
    </div>
  );
}

function LowWalletBanner({ balance }: { balance?: number }) {
  if (balance === undefined || balance >= 5000) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span>Wallet balance ₹{balance.toLocaleString("en-IN")} is below ₹5,000. Top up to avoid campaign interruptions.</span>
    </div>
  );
}

export default function Campaigns() {
  const { data: campaigns, isLoading } = useListCampaigns();
  const { data: segments } = useListSegments();
  const { data: templates } = useListTemplates();
  const { data: wallet } = useGetWallet();
  const { data: session } = useGetSessionRole();
  const queryClient = useQueryClient();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const submitCampaign = useSubmitCampaign();
  const pauseCampaign = usePauseCampaign();
  const approveCampaign = useApproveCampaign();

  const walletBalance = wallet ? parseFloat(String(wallet.balance)) : 0;
  const isManager = session?.role === "manager";
  const isExec = session?.role === "exec";

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [newCampaignId, setNewCampaignId] = useState<number | null>(null);
  const [approvalSheet, setApprovalSheet] = useState<{ id: number; result: any } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    goal: "Appointment Reminder" as string,
    segmentSource: "affordplan" as string,
    audienceSegmentId: 0,
    channels: [] as Array<{ channel: string; templateId: number; perMessageCost: number; templateName?: string; templateBody?: string }>,
  });

  // Pre-select template from URL param (from "Use in campaign" on Templates page)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const tplId = params.get("template");
    const ch = params.get("channel");
    if (tplId && ch && templates) {
      const tpl = templates.find(t => t.id === Number(tplId));
      if (tpl) {
        const chRates: Record<string, number> = { whatsapp: 0.65, sms: 0.18, push: 0.04 };
        setFormData(f => ({
          ...f,
          channels: [{ channel: ch, templateId: tpl.id, perMessageCost: tpl.perMessageCost ?? chRates[ch] ?? 0.18, templateName: tpl.name, templateBody: tpl.body }],
        }));
        setIsWizardOpen(true);
        setStep(2);
        setLocation("/marketing/campaigns");
      }
    }
  }, [search, templates]);

  const resetWizard = () => {
    setIsWizardOpen(false);
    setStep(1);
    setNewCampaignId(null);
    setFormData({ name: "", goal: "Appointment Reminder", segmentSource: "affordplan", audienceSegmentId: 0, channels: [] });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.audienceSegmentId) {
      toast.error("Please fill in all required fields");
      return;
    }
    createCampaign.mutate(
      { data: { name: formData.name, goal: formData.goal, audienceSegmentId: formData.audienceSegmentId, channels: formData.channels as any } },
      {
        onSuccess: (res) => { setNewCampaignId(res.id); setStep(2); },
      }
    );
  };

  const handleUpdateChannels = () => {
    if (!newCampaignId) return;
    if (formData.channels.length === 0) { toast.error("Please add at least one channel"); return; }
    const hasUnpicked = formData.channels.some(c => !c.templateId);
    if (hasUnpicked) { toast.error("Please select a template for each channel"); return; }

    updateCampaign.mutate(
      { id: newCampaignId, data: { channels: formData.channels as any } },
      { onSuccess: () => setStep(3) }
    );
  };

  const handleSubmit = () => {
    if (!newCampaignId) return;
    submitCampaign.mutate(
      { id: newCampaignId },
      {
        onSuccess: () => {
          toast.success("Campaign submitted for approval");
          resetWizard();
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        },
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
        },
      }
    );
  };

  const handleApprove = (id: number) => {
    approveCampaign.mutate(
      { id },
      {
        onSuccess: (result: any) => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          setApprovalSheet({ id, result });
        },
        onError: () => toast.error("Approval failed — check compliance checks"),
      }
    );
  };

  // Cost breakdown
  const computeCost = (channels: typeof formData.channels, recipientCount: number) => {
    const channelCost = channels.reduce((s, c) => s + (c.perMessageCost || 0) * recipientCount, 0);
    const fee = channelCost * 0.05;
    const gst = (channelCost + fee) * 0.18;
    return { channelCost, fee, gst, total: channelCost + fee + gst };
  };

  const selectedSegment = segments?.find(s => s.id === formData.audienceSegmentId);
  const recipients = selectedSegment?.count ?? 0;
  const cost = computeCost(formData.channels, recipients);
  const postSendBalance = walletBalance - cost.total;

  const segmentsBySource = (source: string) =>
    (segments ?? []).filter(s => s.source === source || (source === "affordplan" && !["his", "csv"].includes(s.source)));

  const activeCampaigns = (campaigns ?? []).filter(c => !["submitted", "draft"].includes(c.status));
  const submittedCampaigns = (campaigns ?? []).filter(c => c.status === "submitted");

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Build, approve, and monitor outbound campaigns.</p>
          </div>
          <Button onClick={() => setIsWizardOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Campaign
          </Button>
        </div>

        <LowWalletBanner balance={walletBalance} />

        <Tabs defaultValue="campaigns">
          <TabsList>
            <TabsTrigger value="campaigns">All Campaigns</TabsTrigger>
            <TabsTrigger value="requests">
              Campaign Requests
              {submittedCampaigns.length > 0 && (
                <span className="ml-1.5 bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {submittedCampaigns.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* All Campaigns */}
          <TabsContent value="campaigns" className="mt-4">
            <Card>
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
                      <TableRow><TableCell colSpan={6} className="text-center py-8">Loading…</TableCell></TableRow>
                    ) : !activeCampaigns.length ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No campaigns yet</TableCell></TableRow>
                    ) : (
                      activeCampaigns.map(campaign => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div className="font-medium">{campaign.name}</div>
                            {campaign.createdAt && <div className="text-xs text-muted-foreground">{format(new Date(campaign.createdAt), "d MMM yyyy")}</div>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{campaign.goal}</TableCell>
                          <TableCell className="text-muted-foreground">{campaign.audienceSegmentName}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize border ${STATUS_COLORS[campaign.status] ?? "bg-gray-100 text-gray-700"}`}>
                              {campaign.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {campaign.costBreakdown
                              ? `₹${(campaign.costBreakdown as any).total?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) ?? "—"}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setLocation(`/marketing/metrics?campaign=${campaign.id}`)} title="View Metrics">
                                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              {campaign.status === "live" && isManager && (
                                <Button variant="ghost" size="sm" onClick={() => handlePause(campaign.id)} title="Pause">
                                  <Pause className="w-4 h-4 text-orange-500" />
                                </Button>
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

          {/* Campaign Requests */}
          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pending Manager Approval</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isManager
                    ? "Review and approve campaigns before they launch."
                    : "Campaigns you've submitted await a Marketing Manager's approval."}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Estimated Cost</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submittedCampaigns.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No campaigns awaiting approval</TableCell></TableRow>
                    ) : (
                      submittedCampaigns.map(campaign => {
                        const canApprove = isManager;
                        return (
                          <TableRow key={campaign.id}>
                            <TableCell>
                              <div className="font-medium">{campaign.name}</div>
                              <div className="text-xs text-muted-foreground">{campaign.createdByName}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{campaign.goal}</TableCell>
                            <TableCell className="text-muted-foreground">{campaign.audienceSegmentName}</TableCell>
                            <TableCell>
                              {campaign.costBreakdown
                                ? `₹${(campaign.costBreakdown as any).total?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {campaign.createdAt ? format(new Date(campaign.createdAt), "d MMM") : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {isExec ? (
                                <span className="text-xs text-muted-foreground italic">Manager approval required</span>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleApprove(campaign.id)}
                                  disabled={approveCampaign.isPending}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Approve & Launch
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {isExec && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                You can submit campaigns for approval but cannot approve them. Switch to Manager role to approve.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Campaign Builder Wizard */}
      <Dialog open={isWizardOpen} onOpenChange={open => { if (!open) resetWizard(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 1 && "Step 1 — Campaign Goal & Audience"}
              {step === 2 && "Step 2 — Channels & Template"}
              {step === 3 && "Step 3 — Estimate & Submit"}
            </DialogTitle>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Campaign Name *</label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Diwali Checkup Drive"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Campaign Goal *</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={formData.goal}
                  onChange={e => setFormData(f => ({ ...f, goal: e.target.value }))}
                >
                  {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Audience Source</label>
                <div className="flex gap-2">
                  {[["affordplan", "Affordplan CRM"], ["his", "HIS System"], ["csv", "CSV Upload"]].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, segmentSource: val, audienceSegmentId: 0 }))}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors
                        ${formData.segmentSource === val ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-accent"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Select Segment *</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={formData.audienceSegmentId || ""}
                  onChange={e => setFormData(f => ({ ...f, audienceSegmentId: Number(e.target.value) }))}
                >
                  <option value="" disabled>Select a segment…</option>
                  {segmentsBySource(formData.segmentSource).map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.count.toLocaleString()} patients</option>
                  ))}
                </select>
                {segmentsBySource(formData.segmentSource).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No segments for this source.{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => { resetWizard(); window.location.href = "/marketing/segments"; }}
                    >
                      Create one in Segments tab →
                    </button>
                  </p>
                )}
                {selectedSegment && (
                  <div className="bg-muted/50 border rounded p-2 text-xs text-muted-foreground">
                    <strong>{selectedSegment.count.toLocaleString()}</strong> patients · last refreshed {selectedSegment.lastRefreshAt ? format(new Date(selectedSegment.lastRefreshAt), "d MMM") : "—"}
                    <span className="ml-2 italic">Estimate. Final audience re-evaluated at launch after suppression scrub.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleCreate} disabled={createCampaign.isPending || !formData.name || !formData.audienceSegmentId}>
                  {createCampaign.isPending ? "Creating…" : "Next →"}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Select channels for a <strong>single send</strong>. Each channel sends once to the audience.</p>

              <div className="space-y-3">
                {[
                  { ch: "whatsapp", label: "WhatsApp", rate: 0.65 },
                  { ch: "sms", label: "SMS", rate: 0.18 },
                  { ch: "push", label: "In-app Push", rate: 0.04 },
                ].map(({ ch, label, rate }) => {
                  const isSelected = formData.channels.some(c => c.channel === ch);
                  const chanEntry = formData.channels.find(c => c.channel === ch);
                  const channelTemplates = (templates ?? []).filter(t => t.channel === ch && t.status === "approved");
                  const selectedTpl = chanEntry?.templateId ? templates?.find(t => t.id === chanEntry.templateId) : null;

                  return (
                    <div key={ch} className={`border rounded-lg p-3 transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`ch-${ch}`}
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData(f => ({ ...f, channels: [...f.channels, { channel: ch, templateId: 0, perMessageCost: rate }] }));
                            } else {
                              setFormData(f => ({ ...f, channels: f.channels.filter(c => c.channel !== ch) }));
                            }
                          }}
                          className="w-4 h-4 accent-primary"
                        />
                        <label htmlFor={`ch-${ch}`} className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                          {ch === "whatsapp" && <MessageSquare size={14} className="text-green-600" />}
                          {ch === "sms" && <Smartphone size={14} className="text-blue-600" />}
                          {ch === "push" && <Bell size={14} className="text-orange-500" />}
                          {label}
                        </label>
                        <span className="ml-auto text-xs text-muted-foreground">₹{rate}/msg</span>
                      </div>

                      {isSelected && (
                        <div className="mt-3 space-y-3 pl-7">
                          <select
                            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                            value={chanEntry?.templateId || 0}
                            onChange={e => {
                              const tId = Number(e.target.value);
                              const tpl = templates?.find(t => t.id === tId);
                              setFormData(f => ({
                                ...f,
                                channels: f.channels.map(c =>
                                  c.channel === ch ? { ...c, templateId: tId, perMessageCost: tpl?.perMessageCost ?? rate, templateName: tpl?.name ?? "", templateBody: tpl?.body ?? "" } : c
                                ),
                              }));
                            }}
                          >
                            <option value={0} disabled>Select template…</option>
                            {channelTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name} — ₹{t.perMessageCost}/msg</option>
                            ))}
                          </select>

                          {selectedTpl && (
                            <MiniPreview channel={ch} body={selectedTpl.body} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button onClick={handleUpdateChannels} disabled={updateCampaign.isPending}>
                  {updateCampaign.isPending ? "Saving…" : "Review & Cost →"}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 border rounded-lg overflow-hidden">
                <div className="p-3 bg-muted/80 border-b text-sm font-semibold">Cost Estimate — {selectedSegment?.name}</div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="text-xs text-muted-foreground mb-3">{recipients.toLocaleString("en-IN")} recipients × channels</div>
                  {formData.channels.map(c => (
                    <div key={c.channel} className="flex justify-between">
                      <span className="flex items-center gap-1.5">
                        <ChannelIcon channel={c.channel} />
                        <span className="capitalize">{c.channel}</span>
                        <span className="text-muted-foreground text-xs">₹{c.perMessageCost} × {recipients.toLocaleString()}</span>
                      </span>
                      <span>₹{(c.perMessageCost * recipients).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Channel Cost</span>
                      <span>₹{cost.channelCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Platform Fee (5%)</span>
                      <span>₹{cost.fee.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST 18%</span>
                      <span>₹{cost.gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-2">
                      <span>Total</span>
                      <span>₹{cost.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`flex justify-between items-center p-3 rounded-lg border text-sm ${postSendBalance < 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-muted/50 border-border"}`}>
                <span>Wallet: ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span className="flex items-center gap-1 font-medium">
                  {postSendBalance < 0
                    ? <><AlertCircle className="w-4 h-4" /> Insufficient balance after send</>
                    : <>Post-send balance: ₹{postSendBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</>}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                After submission, a Marketing Manager will review and approve. Wallet is debited only after all compliance checks pass.
              </p>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
                <Button onClick={handleSubmit} disabled={submitCampaign.isPending}>
                  {submitCampaign.isPending ? "Submitting…" : "Submit for Approval"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compliance / Approval Result Sheet */}
      <Sheet open={!!approvalSheet} onOpenChange={open => !open && setApprovalSheet(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {approvalSheet && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  {approvalSheet.result?.passed
                    ? <><CheckCircle2 className="w-5 h-5 text-green-600" /> Campaign Approved & Live</>
                    : <><XCircle className="w-5 h-5 text-red-500" /> Approval Failed</>}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-4">
                {approvalSheet.result?.passed && approvalSheet.result?.invoice && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <div className="font-semibold text-green-800 mb-1">Invoice Generated</div>
                    <div className="text-green-700 space-y-0.5">
                      <div>Invoice: <strong>{approvalSheet.result.invoice.number}</strong></div>
                      <div>Amount: <strong>₹{approvalSheet.result.invoice.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                      <div>GST: ₹{approvalSheet.result.invoice.gst?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      <div className="text-xs text-green-600 mt-1">Auto-sent to ops@sunrisehospital.in</div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-semibold mb-2">Compliance Checks</div>
                  <div className="space-y-2">
                    {(approvalSheet.result?.complianceChecks ?? []).map((check: any, i: number) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${check.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        {check.passed
                          ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                        <div>
                          <div className="font-medium">{check.name}</div>
                          <div className={`text-xs mt-0.5 ${check.passed ? "text-green-700" : "text-red-700"}`}>{check.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {!approvalSheet.result?.passed && (
                  <p className="text-sm text-muted-foreground">
                    Campaign status set to <strong>failed</strong>. Fix the issues above and resubmit a new campaign.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
