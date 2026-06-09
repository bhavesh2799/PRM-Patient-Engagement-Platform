import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListTemplateRequests, useUpdateTemplateRequest, useListTemplates, useUpdateTemplate,
  getListTemplateRequestsQueryKey, getListTemplatesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X, Eye, Globe, Building2, RefreshCw, ChevronRight, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { useState } from "react";

// Simulates Meta polling (5–10s timer)
function simulateMetaPolling(callback: (approved: boolean) => void) {
  const delay = 5000 + Math.random() * 5000;
  setTimeout(() => callback(true), delay);
}

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    whatsapp: { label: "WhatsApp", cls: "border-green-300 text-green-700 bg-green-50" },
    sms: { label: "SMS", cls: "border-blue-300 text-blue-700 bg-blue-50" },
    push: { label: "Push", cls: "border-orange-300 text-orange-700 bg-orange-50" },
  };
  const { label, cls } = map[channel] ?? { label: channel, cls: "border-gray-200 text-gray-700" };
  return <Badge variant="outline" className={`uppercase text-[10px] ${cls}`}>{label}</Badge>;
}

// Per-channel stage strip
function StageStrip({ channel, stage }: { channel: string; stage: string }) {
  let stages: { key: string; label: string }[] = [];
  if (channel === "push") {
    stages = [
      { key: "ap_marketing", label: "AP Marketing Review" },
      { key: "live", label: "Live" },
    ];
  } else if (channel === "sms") {
    stages = [
      { key: "ap_marketing", label: "AP Marketing Review" },
      { key: "channel_compliance", label: "DLT Whitelist & ID Update" },
      { key: "live", label: "Live" },
    ];
  } else {
    stages = [
      { key: "ap_marketing", label: "AP Marketing Review" },
      { key: "channel_compliance", label: "Meta Whitelist (polling)" },
      { key: "live", label: "Live" },
    ];
  }

  const isRejected = stage === "rejected";
  const currentIdx = isRejected ? -1 : stages.findIndex(s => s.key === stage);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {stages.map((s, i) => {
        const done = !isRejected && i < currentIdx;
        const active = !isRejected && i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
              ${done ? "bg-green-100 border-green-400 text-green-700" :
                active ? "bg-blue-100 border-blue-400 text-blue-700 font-bold" :
                  "bg-gray-50 border-gray-200 text-gray-400"}`}>
              {s.label}
            </span>
            {i < stages.length - 1 && <ChevronRight size={10} className="text-gray-300 flex-shrink-0" />}
          </div>
        );
      })}
      {isRejected && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 border border-red-300 text-red-700 font-medium">Rejected</span>
      )}
    </div>
  );
}

// Channel preview
function MiniPreview({ channel, body }: { channel: string; body: string }) {
  const preview = body
    .replace(/\{first_name\}/g, "Priya")
    .replace(/\{([^}]+)\}/g, "[$1]")
    .slice(0, 300);

  if (channel === "sms") {
    return (
      <div className="bg-gray-100 rounded-lg p-3 text-xs">
        <div className="text-gray-400 text-[10px] mb-1">SUNRSE</div>
        <div className="bg-white rounded p-2 text-gray-700 whitespace-pre-wrap">{preview}</div>
      </div>
    );
  }
  if (channel === "whatsapp") {
    return (
      <div className="bg-[#ECE5DD] rounded-lg p-3 text-xs">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white text-[8px] font-bold">S</div>
          <span className="text-gray-500">Sunrise Hospital</span>
        </div>
        <div className="bg-white rounded rounded-tl-none p-2 text-gray-700 whitespace-pre-wrap">{preview}</div>
      </div>
    );
  }
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-xs">
      <div className="flex items-start gap-1.5">
        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">S</div>
        <div>
          <div className="text-gray-300 text-[10px]">Sunrise Hospital</div>
          <div className="text-white whitespace-pre-wrap">{preview}</div>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesAdmin() {
  const { data: requests, isLoading: requestsLoading } = useListTemplateRequests();
  const { data: templates, isLoading: templatesLoading } = useListTemplates();
  const updateRequest = useUpdateTemplateRequest();
  const updateTemplate = useUpdateTemplate();
  const queryClient = useQueryClient();

  const [previewReq, setPreviewReq] = useState<any | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<number>>(new Set());
  const [scopeOverride, setScopeOverride] = useState<Record<number, "global" | "hospital">>({});
  const [dltConsent, setDltConsent] = useState<Record<number, boolean>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTemplateRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
  };

  // Push: direct approve → live
  const handlePushApprove = (id: number, scope: "global" | "hospital" = "hospital") => {
    updateRequest.mutate(
      { id, data: { approvalStage: "live" } },
      {
        onSuccess: () => {
          toast.success("Push template approved and live!");
          updateTemplate.mutate({ id, data: { scope } } as any, { onSuccess: invalidate });
          invalidate();
        },
      }
    );
  };

  // SMS: advance to DLT stage first, then DLT approval → live
  const handleSmsAdvanceToDlt = (id: number) => {
    updateRequest.mutate(
      { id, data: { approvalStage: "channel_compliance" } },
      {
        onSuccess: () => {
          toast.success("Sent to DLT platform for registration. Awaiting DLT whitelist confirmation.");
          invalidate();
        },
      }
    );
  };

  const handleSmsDltApprove = (id: number, scope: "global" | "hospital" = "hospital") => {
    if (!dltConsent[id]) {
      toast.error("Please confirm DLT consent on file before approving.");
      return;
    }
    updateRequest.mutate(
      { id, data: { approvalStage: "live" } },
      {
        onSuccess: () => {
          toast.success("DLT registration confirmed — SMS template is live!");
          updateTemplate.mutate({ id, data: { scope } } as any, { onSuccess: invalidate });
          invalidate();
        },
      }
    );
  };

  // WhatsApp: advance to Meta polling stage, then simulate polling
  const handleWaAdvanceToMeta = (id: number) => {
    updateRequest.mutate(
      { id, data: { approvalStage: "channel_compliance" } },
      {
        onSuccess: () => {
          toast.success("Submitted to Meta BSP. Polling for approval…");
          setPollingIds(prev => new Set(prev).add(id));
          simulateMetaPolling((approved) => {
            if (approved) {
              updateRequest.mutate(
                { id, data: { approvalStage: "live" } },
                {
                  onSuccess: () => {
                    toast.success("Meta returned APPROVED — WhatsApp template is live!");
                    setPollingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
                    invalidate();
                  },
                }
              );
            } else {
              toast.error("Meta returned REJECTED for this template.");
              setPollingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
            }
          });
          invalidate();
        },
      }
    );
  };

  const handleReject = (id: number) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    updateRequest.mutate(
      { id, data: { approvalStage: "rejected", rejectionReason: reason } },
      {
        onSuccess: () => {
          toast.success("Template request rejected");
          invalidate();
        },
      }
    );
  };

  const handleSetScope = (tplId: number, scope: "global" | "hospital") => {
    updateTemplate.mutate(
      { id: tplId, data: { scope } } as any,
      {
        onSuccess: () => {
          toast.success(`Template scope set to ${scope}`);
          invalidate();
        },
      }
    );
  };

  const pendingRequests = (requests ?? []).filter(r => r.approvalStage !== "live");

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <Badge className="mb-2 bg-purple-600">Super Admin</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Template Management</h1>
          <p className="text-muted-foreground mt-1">
            Review hospital template requests and push to channel compliance queues.
          </p>
        </div>

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">
              Approval Queue
              {pendingRequests.length > 0 && (
                <span className="ml-1.5 bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Active Templates</TabsTrigger>
          </TabsList>

          {/* Approval Queue */}
          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
                <CardDescription>
                  Push: approve directly. SMS: send to DLT, confirm on approval. WhatsApp: submit to Meta BSP and poll.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Channel / Goal</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">Loading…</TableCell></TableRow>
                    ) : pendingRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          All requests processed — queue is empty.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingRequests.map(req => {
                        const isPush = req.channel === "push";
                        const isSms = req.channel === "sms";
                        const isWa = req.channel === "whatsapp";
                        const isPolling = pollingIds.has(req.id);
                        const isAtDlt = req.approvalStage === "channel_compliance" && isSms;
                        const isAtMeta = req.approvalStage === "channel_compliance" && isWa;
                        const scope = scopeOverride[req.id] ?? "hospital";

                        return (
                          <TableRow key={req.id}>
                            <TableCell>
                              <div className="font-medium">{req.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1 max-w-[260px] mt-0.5">{req.message}</div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <ChannelBadge channel={req.channel} />
                                <div className="text-xs text-muted-foreground">{req.goal}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{req.createdByName || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">{format(new Date(req.createdAt), "d MMM yyyy")}</div>
                            </TableCell>
                            <TableCell>
                              <StageStrip channel={req.channel} stage={req.approvalStage} />
                              {isPolling && (
                                <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                                  <Loader2 size={11} className="animate-spin" />
                                  Polling Meta…
                                </div>
                              )}
                              {req.rejectionReason && (
                                <div className="text-xs text-destructive mt-1">{req.rejectionReason}</div>
                              )}
                              {/* DLT consent at DLT stage */}
                              {isAtDlt && (
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!dltConsent[req.id]}
                                    onChange={e => setDltConsent(prev => ({ ...prev, [req.id]: e.target.checked }))}
                                    className="w-3 h-3"
                                  />
                                  Consent on file (hospital DLT account)
                                </label>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                {/* Scope picker */}
                                {req.approvalStage === "ap_marketing" && (
                                  <div className="flex gap-1">
                                    {(["hospital", "global"] as const).map(s => (
                                      <button
                                        key={s}
                                        onClick={() => setScopeOverride(prev => ({ ...prev, [req.id]: s }))}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium transition-colors
                                          ${scope === s ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                                      >
                                        {s === "global" ? <Globe size={10} /> : <Building2 size={10} />}
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                <div className="flex gap-1">
                                  {/* Preview */}
                                  <Button variant="outline" size="icon" className="h-7 w-7" title="Preview" onClick={() => setPreviewReq(req)}>
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>

                                  {/* Reject */}
                                  {req.approvalStage !== "rejected" && (
                                    <Button
                                      variant="outline" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                      title="Reject" onClick={() => handleReject(req.id)}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  )}

                                  {/* Approve actions per channel & stage */}
                                  {isPush && req.approvalStage === "ap_marketing" && (
                                    <Button
                                      size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handlePushApprove(req.id, scope)}
                                      disabled={updateRequest.isPending}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Approve
                                    </Button>
                                  )}

                                  {isSms && req.approvalStage === "ap_marketing" && (
                                    <Button
                                      size="sm" className="h-7 text-xs"
                                      onClick={() => handleSmsAdvanceToDlt(req.id)}
                                      disabled={updateRequest.isPending}
                                    >
                                      Send to DLT →
                                    </Button>
                                  )}

                                  {isAtDlt && (
                                    <Button
                                      size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleSmsDltApprove(req.id, scope)}
                                      disabled={updateRequest.isPending || !dltConsent[req.id]}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> DLT Approved
                                    </Button>
                                  )}

                                  {isWa && req.approvalStage === "ap_marketing" && (
                                    <Button
                                      size="sm" className="h-7 text-xs"
                                      onClick={() => handleWaAdvanceToMeta(req.id)}
                                      disabled={updateRequest.isPending || isPolling}
                                    >
                                      <RefreshCw className="w-3 h-3 mr-1" /> Submit to Meta
                                    </Button>
                                  )}

                                  {isAtMeta && !isPolling && (
                                    <span className="text-xs text-muted-foreground italic">Awaiting Meta</span>
                                  )}
                                  {isPolling && (
                                    <span className="text-xs text-blue-600 flex items-center gap-1">
                                      <Loader2 size={11} className="animate-spin" /> Polling…
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Templates */}
          <TabsContent value="active" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Templates</CardTitle>
                <CardDescription>All approved templates across the hospital library. Scope controls hospital vs global pool membership.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Cost/msg</TableHead>
                      <TableHead className="text-right">Scope Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8">Loading…</TableCell></TableRow>
                    ) : !templates?.length ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No templates</TableCell></TableRow>
                    ) : (
                      templates.map(tpl => (
                        <TableRow key={tpl.id}>
                          <TableCell>
                            <div className="font-medium">{tpl.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-[240px] mt-0.5">{tpl.body}</div>
                          </TableCell>
                          <TableCell><ChannelBadge channel={tpl.channel} /></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{tpl.goal}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 w-fit
                              ${tpl.scope === "global" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                              {tpl.scope === "global" ? <Globe size={10} /> : <Building2 size={10} />}
                              {tpl.scope}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">₹{tpl.perMessageCost}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => handleSetScope(tpl.id, tpl.scope === "global" ? "hospital" : "global")}
                                disabled={updateTemplate.isPending}
                              >
                                {tpl.scope === "global" ? "Set hospital" : "Promote global"}
                              </Button>
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
        </Tabs>
      </div>

      {/* Preview Sheet */}
      <Sheet open={!!previewReq} onOpenChange={open => !open && setPreviewReq(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {previewReq && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{previewReq.name}</SheetTitle>
                <div className="flex gap-2 flex-wrap mt-1">
                  <ChannelBadge channel={previewReq.channel} />
                  <Badge variant="secondary">{previewReq.goal}</Badge>
                  <Badge variant="outline" className="capitalize">{previewReq.approvalStage.replace("_", " ")}</Badge>
                </div>
              </SheetHeader>
              <div className="space-y-4">
                <MiniPreview channel={previewReq.channel} body={previewReq.message} />
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Raw message body</div>
                  <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap font-mono">{previewReq.message}</pre>
                </div>
                {previewReq.variables && previewReq.variables !== "none" && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Variables declared</div>
                    <div className="text-sm text-muted-foreground">{previewReq.variables}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Submitted by</div>
                  <div className="text-sm">{previewReq.createdByName} · {format(new Date(previewReq.createdAt), "d MMM yyyy, h:mm a")}</div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
