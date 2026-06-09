import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetSessionRole } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Search, Send, MessageSquare, Phone, Clock,
  AlertCircle, CheckCheck, Check, Zap, UserPlus,
  Users, FileText, RefreshCw, ChevronDown, X, Plus
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  uhid: string | null;
  specialization: string | null;
  sourceChannel: string;
  status: string;
  ownerUserId: number | null;
  ownerName: string | null;
  hasActiveSession: boolean;
  sessionExpiresAt: string | null;
  optedIn: boolean;
  dndListed: boolean;
  createdAt: string;
  lastActionAt: string;
  activityLog?: ActivityEntry[];
}

interface Message {
  id: number;
  leadId: number;
  direction: "in" | "out";
  body: string;
  channel: string;
  templateId: number | null;
  status: string;
  timestamp: string;
}

interface ActivityEntry {
  id: number;
  type: string;
  description: string;
  userId: number | null;
  userName: string | null;
  createdAt: string;
}

interface Template {
  id: number;
  name: string;
  channel: string;
  body: string;
  status: string;
  metaStatus: string | null;
  dltRegisteredBody: string | null;
  perMessageCost: string;
}

// ─── API helpers ──────────────────────────────────────────────

const api = {
  getLeads: async (p: Record<string, string>): Promise<Lead[]> => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([, v]) => v)));
    const r = await fetch(`/api/leads?${qs}`);
    return r.json();
  },
  getLead: async (id: number): Promise<Lead> => fetch(`/api/leads/${id}`).then(r => r.json()),
  getMessages: async (id: number): Promise<Message[]> => fetch(`/api/leads/${id}/messages`).then(r => r.json()),
  getTemplates: async (): Promise<Template[]> => fetch("/api/templates").then(r => r.json()),
  sendMessage: async (leadId: number, data: object) => {
    const r = await fetch(`/api/leads/${leadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw await r.json();
    return r.json() as Promise<Message>;
  },
  updateLead: async (id: number, data: object) => {
    const r = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.json() as Promise<Lead>;
  },
  simulateInbound: async (data: object) => {
    const r = await fetch("/api/leads/simulate-inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
  groupSegment: async (data: object) => {
    const r = await fetch("/api/leads/group-segment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
};

// ─── Helpers ──────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp",
  web_chat: "Web Chat",
  form: "Form",
  csv: "CSV",
  app_booking: "App Booking",
  web_booking: "Web Booking",
  push: "Push",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  in_progress: "In Progress",
  fulfilled: "Fulfilled",
  closed: "Closed",
};

const SESSION_CHANNELS = ["waba", "web_chat"];

function sessionIsOpen(lead: Lead): boolean {
  return (
    lead.hasActiveSession &&
    !!lead.sessionExpiresAt &&
    new Date(lead.sessionExpiresAt) > new Date()
  );
}

function sessionHoursLeft(lead: Lead): number {
  if (!lead.sessionExpiresAt) return 0;
  return Math.max(0, (new Date(lead.sessionExpiresAt).getTime() - Date.now()) / 3600000);
}

function templateChannelFor(sourceChannel: string): string {
  if (sourceChannel === "waba" || sourceChannel === "web_chat") return "whatsapp";
  return sourceChannel;
}

// ─── Sub-components ───────────────────────────────────────────

function DeliveryTick({ status }: { status: string }) {
  if (status === "sent") return <Check className="w-3 h-3 text-muted-foreground/60" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-muted-foreground/80" />;
  if (status === "read") return <CheckCheck className="w-3 h-3 text-blue-400" />;
  return null;
}

function MessageBubble({ msg, localStatus }: { msg: Message; localStatus?: string }) {
  const isOut = msg.direction === "out";
  const status = localStatus ?? msg.status;
  return (
    <div className={cn("flex mb-3", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isOut
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        <p className="whitespace-pre-wrap">{msg.body}</p>
        <div className={cn("flex items-center gap-1 mt-1", isOut ? "justify-end" : "justify-start")}>
          <span className="text-[10px] opacity-60">
            {format(new Date(msg.timestamp), "h:mm a")}
          </span>
          {isOut && <DeliveryTick status={status} />}
        </div>
      </div>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    waba: "bg-green-100 text-green-800",
    web_chat: "bg-blue-100 text-blue-800",
    form: "bg-orange-100 text-orange-800",
    csv: "bg-slate-100 text-slate-700",
    app_booking: "bg-purple-100 text-purple-800",
    web_booking: "bg-indigo-100 text-indigo-800",
    push: "bg-pink-100 text-pink-800",
  };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded uppercase", colors[channel] || "bg-secondary text-secondary-foreground")}>
      {CHANNEL_LABELS[channel] || channel}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function Inbox() {
  const queryClient = useQueryClient();
  const { data: session } = useGetSessionRole() as { data?: { role: string; userId: number | null; userName: string | null } };

  // Filters
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("channel") ?? ""
  );
  const [statusFilter, setStatusFilter] = useState(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("status") ?? ""
  );

  // Selection
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());

  // Composer
  const [composerText, setComposerText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Template picker
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Segment dialog
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [segmentName, setSegmentName] = useState("");

  // Local delivery status tracking
  const [localStatuses, setLocalStatuses] = useState<Record<number, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Queries ────────────────────────────────────────────────

  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery<Lead[]>({
    queryKey: ["leads", channelFilter, statusFilter, search],
    queryFn: () => api.getLeads({ channel: channelFilter, status: statusFilter, search }),
    refetchInterval: 15000,
  });

  const { data: selectedLead, refetch: refetchLead } = useQuery<Lead>({
    queryKey: ["lead", selectedLeadId],
    queryFn: () => api.getLead(selectedLeadId!),
    enabled: !!selectedLeadId,
    refetchInterval: 10000,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["messages", selectedLeadId],
    queryFn: () => api.getMessages(selectedLeadId!),
    enabled: !!selectedLeadId,
    refetchInterval: 5000,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: api.getTemplates,
  });

  // ── Auto-scroll messages ───────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Computed ───────────────────────────────────────────────

  const isSessionOpen = selectedLead ? sessionIsOpen(selectedLead) : false;
  const isSessionChannel = selectedLead ? SESSION_CHANNELS.includes(selectedLead.sourceChannel) : false;
  const isBlocked = selectedLead && (!selectedLead.optedIn || selectedLead.dndListed);
  const hoursLeft = selectedLead ? sessionHoursLeft(selectedLead) : 0;

  const channelTemplates = templates.filter(t => {
    if (!selectedLead) return false;
    const tch = templateChannelFor(selectedLead.sourceChannel);
    if (t.channel !== tch) return false;
    if (t.status !== "approved") return false;
    if (t.channel === "whatsapp" && t.metaStatus !== "APPROVED") return false;
    return true;
  });

  const canFreeText = isSessionChannel && isSessionOpen && !isBlocked;

  // Unread: leads with active session and status=new (approximation)
  const unreadLeadIds = new Set(leads.filter(l => l.hasActiveSession && l.status === "new").map(l => l.id));

  // ── Handlers ──────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedLeadId || !selectedLead || !composerText.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const msg = await api.sendMessage(selectedLeadId, {
        messageType: "free_text",
        body: composerText.trim(),
        channel: selectedLead.sourceChannel,
        userId: session?.userId ?? null,
      });
      setComposerText("");
      setLocalStatuses(prev => ({ ...prev, [msg.id]: "sent" }));
      setTimeout(() => setLocalStatuses(prev => ({ ...prev, [msg.id]: "delivered" })), 1800);
      setTimeout(() => setLocalStatuses(prev => ({ ...prev, [msg.id]: "read" })), 5000);
      refetchMessages();
      refetchLead();
      refetchLeads();
    } catch (err: any) {
      setSendError(err?.error || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTemplate = async (template: Template) => {
    if (!selectedLeadId || !selectedLead) return;
    setSendError(null);
    setIsSending(true);
    try {
      const msg = await api.sendMessage(selectedLeadId, {
        messageType: "template",
        templateId: template.id,
        channel: selectedLead.sourceChannel,
        userId: session?.userId ?? null,
      });
      setLocalStatuses(prev => ({ ...prev, [msg.id]: "sent" }));
      setTimeout(() => setLocalStatuses(prev => ({ ...prev, [msg.id]: "delivered" })), 2000);
      setTimeout(() => setLocalStatuses(prev => ({ ...prev, [msg.id]: "read" })), 6000);
      setShowTemplatePicker(false);
      refetchMessages();
      refetchLead();
      refetchLeads();
    } catch (err: any) {
      setSendError(err?.error || "Failed to send template");
      setShowTemplatePicker(false);
    } finally {
      setIsSending(false);
    }
  };

  const handlePickUp = async () => {
    if (!selectedLeadId || !session?.userId) return;
    await api.updateLead(selectedLeadId, {
      ownerUserId: session.userId,
      status: "in_progress",
      userId: session.userId,
    });
    refetchLead();
    refetchLeads();
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedLeadId) return;
    await api.updateLead(selectedLeadId, { status, userId: session?.userId ?? null });
    refetchLead();
    refetchLeads();
  };

  const handleSimulateInbound = async () => {
    const chatLeads = leads.filter(l => SESSION_CHANNELS.includes(l.sourceChannel));
    const targetLead = selectedLeadId && SESSION_CHANNELS.includes(selectedLead?.sourceChannel || "")
      ? selectedLead
      : chatLeads[Math.floor(Math.random() * chatLeads.length)];
    if (!targetLead) return;
    const channel = (SESSION_CHANNELS.includes(targetLead.sourceChannel) ? targetLead.sourceChannel : "waba") as "waba" | "web_chat";
    await api.simulateInbound({ leadId: targetLead.id, channel });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["messages", targetLead.id] });
    queryClient.invalidateQueries({ queryKey: ["lead", targetLead.id] });
  };

  const handleGroupSegment = async () => {
    if (!segmentName.trim() || bulkSelected.size === 0) return;
    await api.groupSegment({
      leadIds: Array.from(bulkSelected),
      name: segmentName.trim(),
    });
    setShowSegmentDialog(false);
    setSegmentName("");
    setBulkSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["segments"] });
  };

  const toggleBulk = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectLead = (id: number) => {
    setSelectedLeadId(id);
    setSendError(null);
    setComposerText("");
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">

        {/* Page header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unified Inbox</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              All inbound patient conversations, one place
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bulkSelected.size > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowSegmentDialog(true)} className="gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Group {bulkSelected.size} into Segment
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleSimulateInbound} className="gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              Simulate Inbound
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { refetchLeads(); refetchMessages(); }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* 3-panel layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Lead List ─────────────────────────────────── */}
          <div className="w-72 border-r border-border flex flex-col flex-shrink-0 bg-card">
            <div className="p-3 space-y-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, mobile…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5">
                <select
                  value={channelFilter}
                  onChange={e => setChannelFilter(e.target.value)}
                  className="flex-1 text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="">All channels</option>
                  {Object.entries(CHANNEL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="flex-1 text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <ScrollArea className="flex-1">
              {leadsLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Loading leads…</div>
              ) : leads.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No leads match your filters
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {leads.map(lead => {
                    const isUnread = unreadLeadIds.has(lead.id);
                    const isSelected = selectedLeadId === lead.id;
                    const isBulk = bulkSelected.has(lead.id);
                    const ageHours = differenceInHours(new Date(), new Date(lead.createdAt));
                    const slaBreach = lead.status === "new" && ageHours > 24;

                    return (
                      <div
                        key={lead.id}
                        onClick={() => selectLead(lead.id)}
                        className={cn(
                          "p-3 cursor-pointer hover:bg-muted/50 transition-colors relative",
                          isSelected ? "bg-primary/8 border-l-2 border-primary" : "border-l-2 border-transparent",
                          isBulk && "bg-blue-50 dark:bg-blue-950/20"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            onClick={e => toggleBulk(lead.id, e)}
                            className={cn(
                              "w-4 h-4 rounded border mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors",
                              isBulk ? "bg-primary border-primary" : "border-border hover:border-primary"
                            )}
                          >
                            {isBulk && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={cn("font-medium text-sm truncate", isUnread && "text-foreground font-semibold")}>
                                {lead.firstName} {lead.lastName}
                              </span>
                              {isUnread && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <ChannelBadge channel={lead.sourceChannel} />
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded",
                                lead.status === "new" ? "bg-blue-100 text-blue-700" :
                                lead.status === "fulfilled" ? "bg-green-100 text-green-700" :
                                "bg-secondary text-secondary-foreground"
                              )}>
                                {STATUS_LABELS[lead.status] || lead.status}
                              </span>
                              {slaBreach && <AlertCircle className="w-3 h-3 text-orange-500" />}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-muted-foreground truncate">
                                {lead.ownerName ? `Owned: ${lead.ownerName.split(" ")[0]}` : "Unassigned"}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                                {format(new Date(lead.lastActionAt), "MMM d")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ── Chat Panel ────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedLeadId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">Select a lead to start chatting</p>
              </div>
            ) : !selectedLead ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Loading conversation…
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold text-sm">{selectedLead.firstName} {selectedLead.lastName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Phone className="w-3 h-3" /> {selectedLead.mobile}
                        {selectedLead.uhid && <span>• UHID: {selectedLead.uhid}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!selectedLead.ownerUserId ? (
                      <Button size="sm" onClick={handlePickUp} className="h-7 text-xs gap-1">
                        <UserPlus className="w-3 h-3" /> Pick Up
                      </Button>
                    ) : (
                      <span className="text-xs border rounded px-2 py-1 bg-secondary text-secondary-foreground">
                        {selectedLead.ownerName || "Assigned"}
                      </span>
                    )}
                    <select
                      className="text-xs border rounded px-2 py-1 bg-background h-7"
                      value={selectedLead.status}
                      onChange={e => handleStatusChange(e.target.value)}
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message thread */}
                <ScrollArea className="flex-1 px-4 py-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                      <p>No messages yet</p>
                      {isSessionChannel && (
                        <p className="text-xs mt-1">Start by sending a template or simulating an inbound message</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map(msg => (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          localStatus={localStatuses[msg.id]}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Session / channel banner + composer */}
                <div className="border-t border-border flex-shrink-0">
                  {/* Status banner */}
                  {isBlocked ? (
                    <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <span className="text-xs text-destructive font-medium">
                        {!selectedLead.optedIn ? "Patient has opted out — messaging blocked" : "Patient is on DND list — messaging blocked"}
                      </span>
                    </div>
                  ) : isSessionChannel && !isSessionOpen ? (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span className="text-xs text-amber-800">
                          Session expired — send an approved template to re-open the 24h window
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs border-amber-300"
                        onClick={() => setShowTemplatePicker(true)}
                      >
                        <FileText className="w-3 h-3 mr-1" /> Send Template
                      </Button>
                    </div>
                  ) : isSessionChannel && isSessionOpen ? (
                    <div className="px-4 py-1.5 bg-green-50 border-b border-green-200 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-xs text-green-800">
                        Session open · expires in {hoursLeft.toFixed(0)}h
                      </span>
                    </div>
                  ) : !isSessionChannel ? (
                    <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        {CHANNEL_LABELS[selectedLead.sourceChannel]} is template-only
                      </span>
                    </div>
                  ) : null}

                  {/* Composer */}
                  {!isBlocked && (
                    <div className="p-3">
                      {sendError && (
                        <div className="mb-2 text-xs text-destructive bg-destructive/10 rounded px-2 py-1 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          {sendError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={
                            canFreeText
                              ? "Type a message… (session is open)"
                              : "Free text unavailable — use template"
                          }
                          className="flex-1 min-h-[60px] max-h-32 text-sm resize-none"
                          value={composerText}
                          disabled={!canFreeText}
                          onChange={e => setComposerText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                        />
                        <div className="flex flex-col gap-1.5">
                          {canFreeText && (
                            <Button
                              size="sm"
                              onClick={handleSend}
                              disabled={isSending || !composerText.trim()}
                              className="h-7 px-2.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowTemplatePicker(true)}
                            className="h-7 px-2.5 text-xs"
                            title="Insert template"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Profile & Activity Panel ───────────────────── */}
          {selectedLead && (
            <div className="w-72 border-l border-border flex flex-col overflow-hidden flex-shrink-0 bg-card/50">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead Profile</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-base font-semibold">{selectedLead.firstName} {selectedLead.lastName}</p>
                    <p className="text-xs text-muted-foreground">{selectedLead.mobile}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Channel</p>
                      <ChannelBadge channel={selectedLead.sourceChannel} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium">{STATUS_LABELS[selectedLead.status]}</p>
                    </div>
                    {selectedLead.uhid && (
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">UHID</p>
                        <p className="font-medium font-mono text-xs">{selectedLead.uhid}</p>
                      </div>
                    )}
                    {selectedLead.specialization && (
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Specialization</p>
                        <p className="font-medium">{selectedLead.specialization}</p>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Owner</p>
                      <p className="font-medium">{selectedLead.ownerName || "Unassigned"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Lead Age</p>
                      <p className={cn("font-medium text-xs", differenceInHours(new Date(), new Date(selectedLead.createdAt)) > 24 && selectedLead.status === "new" ? "text-orange-600" : "")}>
                        {formatDistanceToNow(new Date(selectedLead.createdAt), { addSuffix: false })}
                        {differenceInHours(new Date(), new Date(selectedLead.createdAt)) > 24 && selectedLead.status === "new" && " ⚠️"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 text-xs">
                    <span className={cn("px-2 py-0.5 rounded-full border",
                      selectedLead.optedIn ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700")}>
                      {selectedLead.optedIn ? "✓ Opted In" : "✗ Opted Out"}
                    </span>
                    {selectedLead.dndListed && (
                      <span className="px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700">DND</span>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Activity Log</h4>
                    <div className="space-y-3">
                      {!selectedLead.activityLog?.length ? (
                        <p className="text-xs text-muted-foreground">No activity yet</p>
                      ) : (
                        [...(selectedLead.activityLog || [])].reverse().map(entry => (
                          <div key={entry.id} className="relative pl-3 border-l-2 border-primary/20 pb-2 last:pb-0">
                            <div className="absolute w-1.5 h-1.5 bg-primary/40 rounded-full -left-1 top-1" />
                            <p className="text-xs font-medium capitalize">{entry.type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                              {entry.userName ? ` · ${entry.userName}` : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* ── Template Picker Dialog ────────────────────────── */}
      <Dialog open={showTemplatePicker} onOpenChange={setShowTemplatePicker}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Send a Template</DialogTitle>
          </DialogHeader>
          {channelTemplates.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No approved templates for {selectedLead ? CHANNEL_LABELS[selectedLead.sourceChannel] : "this channel"}.
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-3">
                {channelTemplates.map(tpl => (
                  <div
                    key={tpl.id}
                    className="border rounded-lg p-3 hover:border-primary/60 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleSendTemplate(tpl)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-medium text-sm">{tpl.name}</p>
                      <span className="text-xs text-muted-foreground">
                        ₹{(parseFloat(tpl.perMessageCost) * 1.05 * 1.18).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{tpl.body}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Group into Segment Dialog ─────────────────────── */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Group into Segment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a named segment from the {bulkSelected.size} selected leads.
            </p>
            <Input
              placeholder="Segment name…"
              value={segmentName}
              onChange={e => setSegmentName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSegmentDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleGroupSegment} disabled={!segmentName.trim()}>
                Create Segment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
