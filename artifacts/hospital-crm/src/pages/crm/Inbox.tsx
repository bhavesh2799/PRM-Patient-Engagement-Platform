import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetSessionRole, useListUsers } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Search, Send, MessageSquare, Phone, Clock, AlertCircle, CheckCheck, Check,
  Zap, UserPlus, Users, FileText, RefreshCw, X, StickyNote, Download, Copy,
  Tag, Plus, ChevronDown, Mail, PhoneCall, PhoneOff, PhoneMissed, Voicemail,
  Package, FlaskConical, CalendarClock, Smartphone, ChevronRight, CircleDot,
  ArrowRight, TimerIcon
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────

interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string | null;
  uhid: string | null;
  specialization: string | null;
  sourceChannel: string;
  sourceListTag: string | null;
  lastVisitDate: string | null;
  status: string;
  moduleStage: string | null;
  transactionContext: Record<string, unknown> | null;
  ownerUserId: number | null;
  ownerName: string | null;
  hasActiveSession: boolean;
  sessionExpiresAt: string | null;
  optedIn: boolean;
  dndListed: boolean;
  createdAt: string;
  lastActionAt: string;
  activityLog?: ActivityEntry[];
  tags?: string[] | null;
}

interface Message {
  id: number;
  leadId: number;
  direction: "in" | "out";
  body: string;
  subject: string | null;
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

interface TagItem { id: number; name: string; color: string; archived: boolean; }
interface QuickReply { id: number; text: string; sortOrder: number; }

// ─── API helpers ──────────────────────────────────────────────

const api = {
  getLeads: async (p: Record<string, string>): Promise<Lead[]> => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([, v]) => v)));
    return fetch(`/api/leads?${qs}`).then(r => r.json());
  },
  getLead: async (id: number): Promise<Lead> => fetch(`/api/leads/${id}`).then(r => r.json()),
  getMessages: async (id: number): Promise<Message[]> => fetch(`/api/leads/${id}/messages`).then(r => r.json()),
  getTemplates: async (): Promise<Template[]> => fetch("/api/templates").then(r => r.json()),
  getTags: async (): Promise<TagItem[]> => fetch("/api/tags").then(r => r.json()),
  getQuickReplies: async (): Promise<QuickReply[]> => fetch("/api/settings/quick-replies").then(r => r.json()),
  sendMessage: async (leadId: number, data: object) => {
    const r = await fetch(`/api/leads/${leadId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!r.ok) throw await r.json();
    return r.json() as Promise<Message>;
  },
  updateLead: async (id: number, data: object) => {
    const r = await fetch(`/api/leads/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    return r.json();
  },
  addNote: async (leadId: number, note: string, userId: number | null) => {
    const r = await fetch(`/api/leads/${leadId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, userId }),
    });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  bulkAction: async (data: object) => {
    const r = await fetch("/api/leads/bulk", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    return r.json();
  },
  simulateInbound: async (data: object) => {
    const r = await fetch("/api/leads/simulate-inbound", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    return r.json();
  },
  groupSegment: async (data: object) => {
    const r = await fetch("/api/leads/group-segment", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    return r.json();
  },
  logCall: async (leadId: number, data: object) => {
    const r = await fetch(`/api/leads/${leadId}/calls`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  advanceStage: async (leadId: number, stage: string, userId: number | null) => {
    const r = await fetch(`/api/leads/${leadId}/stage`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, userId }),
    });
    if (!r.ok) throw await r.json();
    return r.json();
  },
};

// ─── Helpers ──────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp", web_chat: "Web Chat", form: "Web Form", csv: "CSV",
  app_booking: "App Booking", web_booking: "Web Booking",
  email: "Email", medicine_order: "Medicine Order", lab_test: "Lab Test",
  web_appointment: "Web Appt", app_appointment: "App Appt",
};

const MODULE_CHANNELS = ["medicine_order", "lab_test", "web_appointment", "app_appointment"];

const MODULE_STAGES: Record<string, string[]> = {
  medicine_order: ["order_placed", "processing", "dispatched", "delivered"],
  lab_test: ["sample_collected", "processing", "result_ready", "reviewed"],
  web_appointment: ["scheduled", "confirmed", "visited", "follow_up"],
  app_appointment: ["scheduled", "confirmed", "visited", "follow_up"],
};

const MODULE_STAGE_LABELS: Record<string, string> = {
  order_placed: "Order Placed", processing: "Processing", dispatched: "Dispatched", delivered: "Delivered",
  sample_collected: "Sample Collected", result_ready: "Result Ready", reviewed: "Reviewed",
  scheduled: "Scheduled", confirmed: "Confirmed", visited: "Visited", follow_up: "Follow-up",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", in_progress: "In Progress",
  fulfilled: "Fulfilled", closed: "Closed",
};

const SESSION_CHANNELS = ["waba", "web_chat"];

function sessionIsOpen(lead: Lead): boolean {
  return lead.hasActiveSession && !!lead.sessionExpiresAt && new Date(lead.sessionExpiresAt) > new Date();
}

function sessionHoursLeft(lead: Lead): number {
  if (!lead.sessionExpiresAt) return 0;
  return Math.max(0, (new Date(lead.sessionExpiresAt).getTime() - Date.now()) / 3600000);
}

function templateChannelFor(sourceChannel: string): string {
  return (sourceChannel === "waba" || sourceChannel === "web_chat") ? "whatsapp" : sourceChannel;
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
  const isEmail = msg.channel === "email";
  return (
    <div className={cn("flex mb-3", isOut ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
        isOut ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm",
        isEmail && "rounded-xl"
      )}>
        {isEmail && msg.subject && (
          <div className={cn("flex items-center gap-1.5 mb-1.5 pb-1.5 border-b", isOut ? "border-primary-foreground/20" : "border-border")}>
            <Mail className="w-3 h-3 opacity-60 flex-shrink-0" />
            <span className="text-xs font-semibold">{msg.subject}</span>
          </div>
        )}
        <p className="whitespace-pre-wrap">{msg.body}</p>
        <div className={cn("flex items-center gap-1 mt-1", isOut ? "justify-end" : "justify-start")}>
          {isEmail && (
            <span className={cn("text-[9px] uppercase tracking-wide opacity-50 mr-1")}>email</span>
          )}
          <span className="text-[10px] opacity-60">{format(new Date(msg.timestamp), "h:mm a")}</span>
          {isOut && <DeliveryTick status={status} />}
        </div>
      </div>
    </div>
  );
}

function NoteBubble({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex justify-center mb-3">
      <div className="max-w-[80%] rounded-xl px-3.5 py-2 text-sm bg-amber-50 border border-amber-200 text-amber-900">
        <div className="flex items-center gap-1.5 mb-1 opacity-70">
          <StickyNote className="w-3 h-3" />
          <span className="text-[10px] font-medium">Internal note</span>
          {entry.userName && <span className="text-[10px]">· {entry.userName}</span>}
        </div>
        <p className="whitespace-pre-wrap">{entry.description}</p>
        <p className="text-[10px] opacity-60 mt-1">{format(new Date(entry.createdAt), "h:mm a")}</p>
      </div>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    waba: "bg-green-100 text-green-800", web_chat: "bg-blue-100 text-blue-800",
    form: "bg-orange-100 text-orange-800", csv: "bg-slate-100 text-slate-700",
    app_booking: "bg-purple-100 text-purple-800", web_booking: "bg-indigo-100 text-indigo-800",
    email: "bg-violet-100 text-violet-800",
    medicine_order: "bg-rose-100 text-rose-800",
    lab_test: "bg-cyan-100 text-cyan-800",
    web_appointment: "bg-amber-100 text-amber-800",
    app_appointment: "bg-teal-100 text-teal-800",
  };
  const icon = channel === "email" ? <Mail className="w-2.5 h-2.5" /> :
    channel === "medicine_order" ? <Package className="w-2.5 h-2.5" /> :
    channel === "lab_test" ? <FlaskConical className="w-2.5 h-2.5" /> :
    channel === "web_appointment" ? <CalendarClock className="w-2.5 h-2.5" /> :
    channel === "app_appointment" ? <Smartphone className="w-2.5 h-2.5" /> : null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase", colors[channel] || "bg-secondary text-secondary-foreground")}>
      {icon}{CHANNEL_LABELS[channel] || channel}
    </span>
  );
}

function TagPill({ name, color, onRemove }: { name: string; color?: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
      style={{ backgroundColor: color || "#94a3b8" }}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function Inbox() {
  const queryClient = useQueryClient();
  const { data: session } = useGetSessionRole() as { data?: { role: string; userId: number | null; userName: string | null } };
  const { data: teamUsers = [] } = useListUsers() as { data?: Array<{ id: number; name: string; role: string; active: boolean }> };
  const isManager = session?.role === "manager" || session?.role === "ap_admin";

  // Filters
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("channel") ?? ""
  );
  const [statusFilter, setStatusFilter] = useState(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("status") ?? ""
  );
  const [myLeads, setMyLeads] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "sla" | "unread">("newest");

  // Selection
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());

  // Composer
  const [composerText, setComposerText] = useState("");
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [emailSubject, setEmailSubject] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Dialogs
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [segmentName, setSegmentName] = useState("");

  // Call modal
  const [showCallModal, setShowCallModal] = useState(false);
  const [callStep, setCallStep] = useState<"ringing" | "outcome" | "connected" | "done">("ringing");
  const [callConnectedSecs, setCallConnectedSecs] = useState(0);
  const [callOutcome, setCallOutcome] = useState<string | null>(null);
  const [callNote, setCallNote] = useState("");
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stage advance dialog
  const [showStageDialog, setShowStageDialog] = useState(false);
  const [pendingStage, setPendingStage] = useState<string | null>(null);

  // Activity filter
  const [activityFilter, setActivityFilter] = useState<"all" | "message" | "status_change" | "assignment" | "note" | "call" | "stage_change">("all");

  // Local delivery
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

  const { data: availableTags = [] } = useQuery<TagItem[]>({
    queryKey: ["tags"],
    queryFn: api.getTags,
  });

  const { data: quickReplies = [] } = useQuery<QuickReply[]>({
    queryKey: ["quick-replies"],
    queryFn: api.getQuickReplies,
  });

  // ── Auto-scroll ─────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Computed ───────────────────────────────────────────────

  const unreadLeadIds = new Set(leads.filter(l => l.hasActiveSession && l.status === "new").map(l => l.id));

  const sortedLeads = [...leads]
    .filter(l => !myLeads || l.ownerUserId === session?.userId)
    .sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "unread") {
        const diff = Number(unreadLeadIds.has(b.id)) - Number(unreadLeadIds.has(a.id));
        if (diff !== 0) return diff;
      }
      if (sortBy === "sla") {
        const sla = (l: Lead) => l.status === "new" && differenceInHours(new Date(), new Date(l.createdAt)) > 24 ? 1 : 0;
        const diff = sla(b) - sla(a);
        if (diff !== 0) return diff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const isSessionOpen = selectedLead ? sessionIsOpen(selectedLead) : false;
  const isSessionChannel = selectedLead ? SESSION_CHANNELS.includes(selectedLead.sourceChannel) : false;
  const isBlocked = selectedLead && (!selectedLead.optedIn || selectedLead.dndListed);
  const hoursLeft = selectedLead ? sessionHoursLeft(selectedLead) : 0;

  const channelTemplates = templates.filter(t => {
    if (!selectedLead) return false;
    const tch = templateChannelFor(selectedLead.sourceChannel);
    if (t.channel !== tch || t.status !== "approved") return false;
    if (t.channel === "whatsapp" && t.metaStatus !== "APPROVED") return false;
    return true;
  });

  const canFreeText = isSessionChannel && isSessionOpen && !isBlocked && composerMode === "reply";

  const filteredActivity = (selectedLead?.activityLog ?? []).filter(a => {
    if (activityFilter === "all") return true;
    if (activityFilter === "message") return a.type.startsWith("message") || a.type === "template_sent";
    return a.type === activityFilter;
  });

  const tagColorMap = Object.fromEntries(availableTags.filter(t => !t.archived).map(t => [t.name, t.color]));
  const currentTags = selectedLead?.tags ?? [];
  const addableTags = availableTags.filter(t => !t.archived && !currentTags.includes(t.name));

  // ── Handlers ──────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedLeadId || !selectedLead || !composerText.trim()) return;

    if (composerMode === "note") {
      setIsSending(true);
      setSendError(null);
      try {
        await api.addNote(selectedLeadId, composerText.trim(), session?.userId ?? null);
        setComposerText("");
        refetchLead();
        toast.success("Note added");
      } catch {
        setSendError("Failed to add note");
      } finally {
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      const isEmail = selectedLead.sourceChannel === "email";
      const msg = await api.sendMessage(selectedLeadId, {
        messageType: "free_text",
        body: composerText.trim(),
        ...(isEmail && emailSubject.trim() ? { subject: emailSubject.trim() } : {}),
        channel: selectedLead.sourceChannel,
        userId: session?.userId ?? null,
      });
      setComposerText("");
      if (isEmail) setEmailSubject("");
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

  const handleOpenCall = () => {
    setCallStep("ringing");
    setCallConnectedSecs(0);
    setCallOutcome(null);
    setCallNote("");
    setShowCallModal(true);
    // Simulate ringing → show outcome after 2s
    setTimeout(() => setCallStep("outcome"), 2000);
  };

  const handleCallConnect = () => {
    setCallStep("connected");
    setCallConnectedSecs(0);
    callTimerRef.current = setInterval(() => setCallConnectedSecs(s => s + 1), 1000);
  };

  const handleCallEnd = () => {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    setCallStep("done");
    setCallOutcome("connected");
  };

  const handleCallOutcomeSelect = (outcome: string) => {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    setCallOutcome(outcome);
    setCallStep("done");
  };

  const handleCallSave = async () => {
    if (!selectedLeadId || !callOutcome) return;
    try {
      await api.logCall(selectedLeadId, {
        outcome: callOutcome,
        durationSeconds: callOutcome === "connected" ? callConnectedSecs : null,
        note: callNote.trim() || null,
        userId: session?.userId ?? null,
      });
      setShowCallModal(false);
      refetchLead(); refetchLeads();
      toast.success(`Call logged: ${callOutcome.replace(/_/g, " ")}`);
    } catch {
      toast.error("Failed to log call");
    }
  };

  const handleAdvanceStage = async (stage: string) => {
    if (!selectedLeadId) return;
    try {
      await api.advanceStage(selectedLeadId, stage, session?.userId ?? null);
      setShowStageDialog(false);
      setPendingStage(null);
      refetchLead(); refetchLeads();
      toast.success(`Stage advanced to: ${MODULE_STAGE_LABELS[stage] || stage}`);
    } catch {
      toast.error("Failed to advance stage");
    }
  };

  const handleSendTemplate = async (template: Template) => {
    if (!selectedLeadId || !selectedLead) return;
    setSendError(null);
    setIsSending(true);
    try {
      const msg = await api.sendMessage(selectedLeadId, {
        messageType: "template", templateId: template.id,
        channel: selectedLead.sourceChannel, userId: session?.userId ?? null,
      });
      setLocalStatuses(prev => ({ ...prev, [msg.id]: "sent" }));
      setTimeout(() => setLocalStatuses(prev => ({ ...prev, [msg.id]: "delivered" })), 2000);
      setTimeout(() => setLocalStatuses(prev => ({ ...prev, [msg.id]: "read" })), 6000);
      setShowTemplatePicker(false);
      refetchMessages(); refetchLead(); refetchLeads();
    } catch (err: any) {
      setSendError(err?.error || "Failed to send template");
      setShowTemplatePicker(false);
    } finally {
      setIsSending(false);
    }
  };

  const handlePickUp = async () => {
    if (!selectedLeadId || !session?.userId) return;
    await api.updateLead(selectedLeadId, { ownerUserId: session.userId, status: "in_progress", userId: session.userId });
    refetchLead(); refetchLeads();
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedLeadId) return;
    await api.updateLead(selectedLeadId, { status, userId: session?.userId ?? null });
    refetchLead(); refetchLeads();
  };

  const handleSimulateInbound = async () => {
    const chatLeads = leads.filter(l => SESSION_CHANNELS.includes(l.sourceChannel));
    const targetLead = selectedLeadId && SESSION_CHANNELS.includes(selectedLead?.sourceChannel || "")
      ? selectedLead : chatLeads[Math.floor(Math.random() * chatLeads.length)];
    if (!targetLead) return;
    const channel = (SESSION_CHANNELS.includes(targetLead.sourceChannel) ? targetLead.sourceChannel : "waba") as "waba" | "web_chat";
    await api.simulateInbound({ leadId: targetLead.id, channel });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["messages", targetLead.id] });
    queryClient.invalidateQueries({ queryKey: ["lead", targetLead.id] });
  };

  const handleGroupSegment = async () => {
    if (!segmentName.trim() || bulkSelected.size === 0) return;
    await api.groupSegment({ leadIds: Array.from(bulkSelected), name: segmentName.trim() });
    setShowSegmentDialog(false);
    setSegmentName("");
    setBulkSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["segments"] });
    toast.success(`Segment "${segmentName}" created`);
  };

  const handleBulkAssignTo = async (ownerId: number, ownerName: string) => {
    if (bulkSelected.size === 0) return;
    await api.bulkAction({ leadIds: Array.from(bulkSelected), ownerUserId: ownerId, userId: session?.userId ?? null });
    setBulkSelected(new Set());
    refetchLeads();
    toast.success(`${bulkSelected.size} leads assigned to ${ownerName}`);
  };

  const handleBulkAssign = async () => {
    if (bulkSelected.size === 0 || !session?.userId) return;
    await api.bulkAction({ leadIds: Array.from(bulkSelected), ownerUserId: session.userId, userId: session.userId });
    setBulkSelected(new Set());
    refetchLeads();
    toast.success(`${bulkSelected.size} leads assigned to you`);
  };

  const handleBulkStatus = async (status: string) => {
    if (bulkSelected.size === 0) return;
    await api.bulkAction({ leadIds: Array.from(bulkSelected), status, userId: session?.userId ?? null });
    setBulkSelected(new Set());
    refetchLeads();
    toast.success(`${bulkSelected.size} leads set to ${STATUS_LABELS[status]}`);
  };

  const handleExportCsv = () => {
    const selected = leads.filter(l => bulkSelected.has(l.id));
    const rows = [
      ["Name", "Mobile", "Channel", "Status", "Owner", "Specialisation", "Tags", "Created"],
      ...selected.map(l => [
        `${l.firstName} ${l.lastName}`, l.mobile, l.sourceChannel, l.status,
        l.ownerName ?? "", l.specialization ?? "", (l.tags ?? []).join("; "),
        new Date(l.createdAt).toLocaleDateString("en-IN"),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${selected.length} leads exported`);
  };

  const handleToggleTag = async (tagName: string) => {
    if (!selectedLead || !selectedLeadId) return;
    const current = selectedLead.tags ?? [];
    const updated = current.includes(tagName) ? current.filter(t => t !== tagName) : [...current, tagName];
    await api.updateLead(selectedLeadId, { tags: updated, userId: session?.userId ?? null });
    refetchLead();
    setShowAddTag(false);
  };

  const handleCopyUhid = () => {
    if (!selectedLead?.uhid) return;
    navigator.clipboard.writeText(selectedLead.uhid);
    toast.success("UHID copied to clipboard");
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
    setEmailSubject("");
    setComposerMode("reply");
    setShowAddTag(false);
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">

        {/* Page header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unified Inbox</h1>
            <p className="text-muted-foreground text-sm mt-0.5">All inbound patient conversations, one place</p>
          </div>
          <div className="flex items-center gap-2">
            {bulkSelected.size > 0 && (
              <>
                {isManager ? (
                  <select
                    className="text-xs border rounded px-2 py-1 bg-background h-8 gap-1"
                    defaultValue=""
                    onChange={e => {
                      const [id, name] = e.target.value.split("|");
                      if (id && name) handleBulkAssignTo(Number(id), name);
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>Assign to…</option>
                    {teamUsers.filter(u => u.active).map(u => (
                      <option key={u.id} value={`${u.id}|${u.name}`}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleBulkAssign} className="gap-1.5 text-xs">
                    <UserPlus className="w-3 h-3" /> Assign to me
                  </Button>
                )}
                <div className="relative">
                  <select
                    className="text-xs border rounded px-2 py-1 bg-background h-8"
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleBulkStatus(e.target.value); e.target.value = ""; }}
                  >
                    <option value="" disabled>Set status…</option>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowSegmentDialog(true)} className="gap-1.5 text-xs">
                  <Users className="w-3 h-3" /> Group ({bulkSelected.size})
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportCsv} className="gap-1.5 text-xs">
                  <Download className="w-3 h-3" /> Export
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBulkSelected(new Set())} className="text-xs px-2">
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </>
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
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search name, mobile…"
                    className="pl-8 h-8 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setMyLeads(!myLeads)}
                  className={cn(
                    "h-8 px-2 rounded text-xs font-medium border transition-colors whitespace-nowrap",
                    myLeads ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary text-muted-foreground"
                  )}
                >
                  My leads
                </button>
              </div>
              <div className="flex gap-1.5">
                <select
                  value={channelFilter}
                  onChange={e => setChannelFilter(e.target.value)}
                  className="flex-1 text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="">All channels</option>
                  {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="flex-1 text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Sort:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="sla">SLA breach first</option>
                  <option value="unread">Unread first</option>
                </select>
                <button
                  onClick={() => setBulkSelected(new Set(sortedLeads.map(l => l.id)))}
                  className="text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap"
                >
                  All
                </button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              {leadsLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Loading leads…</div>
              ) : sortedLeads.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {myLeads ? "No leads assigned to you" : "No leads match your filters"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {sortedLeads.map(lead => {
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
                              <span className={cn("font-medium text-sm truncate", isUnread && "font-semibold")}>
                                {lead.firstName} {lead.lastName}
                              </span>
                              {isUnread && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <ChannelBadge channel={lead.sourceChannel} />
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded",
                                lead.status === "new" ? "bg-blue-100 text-blue-700" :
                                  lead.status === "fulfilled" ? "bg-green-100 text-green-700" :
                                    "bg-secondary text-secondary-foreground"
                              )}>
                                {STATUS_LABELS[lead.status] || lead.status}
                              </span>
                              {MODULE_CHANNELS.includes(lead.sourceChannel) && lead.moduleStage && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                                  {MODULE_STAGE_LABELS[lead.moduleStage] || lead.moduleStage}
                                </span>
                              )}
                              {slaBreach && <AlertCircle className="w-3 h-3 text-orange-500" />}
                              {!lead.optedIn && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">Opt-out</span>}
                              {lead.dndListed && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">DND</span>}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-muted-foreground truncate">
                                {lead.ownerName ? lead.ownerName.split(" ")[0] : "Unassigned"}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                                {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: false }).replace("about ", "").replace(" hours", "h").replace(" hour", "h").replace(" minutes", "m").replace(" days", "d").replace(" day", "d")} ago
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
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <MessageSquare className="h-12 w-12 opacity-20" />
                <p className="text-sm">Select a lead to start chatting</p>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-2xl font-bold">{leads.length}</div>
                    <div className="text-xs text-muted-foreground">Total leads</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <div className="text-2xl font-bold text-blue-600">{leads.filter(l => l.status === "new").length}</div>
                    <div className="text-xs text-muted-foreground">New / unactioned</div>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-3">
                    <div className="text-2xl font-bold text-orange-500">
                      {leads.filter(l => l.status === "new" && differenceInHours(new Date(), new Date(l.createdAt)) > 24).length}
                    </div>
                    <div className="text-xs text-muted-foreground">SLA breaches</div>
                  </div>
                </div>
              </div>
            ) : !selectedLead ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading conversation…</div>
            ) : (
              <>
                {/* Chat header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                  <div>
                    <div className="font-semibold text-sm">{selectedLead.firstName} {selectedLead.lastName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Phone className="w-3 h-3" /> {selectedLead.mobile}
                      {selectedLead.email && <><Mail className="w-3 h-3 ml-1" /> {selectedLead.email}</>}
                      {selectedLead.uhid && <span>· UHID: {selectedLead.uhid}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" variant="outline"
                      onClick={handleOpenCall}
                      className="h-7 px-2 gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                      title="Log a call"
                    >
                      <PhoneCall className="w-3 h-3" />
                    </Button>
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
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>

                {/* Message thread + Notes */}
                <ScrollArea className="flex-1 px-4 py-3">
                  {messages.length === 0 && filteredActivity.filter(a => a.type === "note").length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map(msg => (
                        <MessageBubble key={msg.id} msg={msg} localStatus={localStatuses[msg.id]} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Composer */}
                <div className="border-t border-border flex-shrink-0">
                  {/* Email composer (for email leads) */}
                  {selectedLead.sourceChannel === "email" && composerMode === "reply" ? (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setComposerMode("reply")}
                          className={cn("flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                            "bg-primary text-primary-foreground border-primary")}
                        >
                          <Mail className="w-3 h-3" /> Reply
                        </button>
                        <button
                          onClick={() => setComposerMode("note")}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-amber-300 transition-colors"
                        >
                          <StickyNote className="w-3 h-3" /> Note
                        </button>
                        <span className="text-xs text-muted-foreground ml-auto truncate">
                          To: <span className="font-medium">{selectedLead.email || selectedLead.mobile}</span>
                        </span>
                      </div>
                      <Input
                        placeholder="Subject…"
                        className="h-7 text-xs"
                        value={emailSubject}
                        onChange={e => setEmailSubject(e.target.value)}
                      />
                      {sendError && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" /> {sendError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Type your email reply…"
                          className="flex-1 min-h-[64px] max-h-28 text-sm resize-none"
                          value={composerText}
                          onChange={e => setComposerText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
                        />
                        <Button
                          size="sm" onClick={handleSend}
                          disabled={isSending || !composerText.trim()}
                          className="h-auto flex-col gap-1 px-3"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span className="text-[10px]">Send</span>
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
                    </div>
                  ) : selectedLead.sourceChannel === "email" && composerMode === "note" ? (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setComposerMode("reply")}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary transition-colors"
                        >
                          <Mail className="w-3 h-3" /> Reply
                        </button>
                        <button
                          onClick={() => setComposerMode("note")}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-amber-100 text-amber-800 border-amber-300 transition-colors"
                        >
                          <StickyNote className="w-3 h-3" /> Note
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Add an internal note…"
                          className="flex-1 min-h-[60px] max-h-28 text-sm resize-none bg-amber-50/50 border-amber-200"
                          value={composerText}
                          onChange={e => setComposerText(e.target.value)}
                        />
                        <Button size="sm" onClick={handleSend} disabled={isSending || !composerText.trim()} className="bg-amber-500 hover:bg-amber-600 h-auto px-3">
                          <StickyNote className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {/* Status banners (non-email channels) */}
                  {selectedLead.sourceChannel !== "email" && isBlocked ? (
                    <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      <span className="text-xs text-destructive font-medium">
                        {!selectedLead.optedIn ? "Patient opted out — messaging blocked" : "Patient on DND list — messaging blocked"}
                      </span>
                    </div>
                  ) : isSessionChannel && !isSessionOpen ? (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span className="text-xs text-amber-800">Session expired — send an approved template to re-open</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-6 text-xs border-amber-300" onClick={() => setShowTemplatePicker(true)}>
                        <FileText className="w-3 h-3 mr-1" /> Use template
                      </Button>
                    </div>
                  ) : isSessionChannel && isSessionOpen ? (
                    <div className="px-4 py-1.5 bg-green-50 border-b border-green-200 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-xs text-green-800">Session open · expires in {hoursLeft.toFixed(0)}h</span>
                    </div>
                  ) : !isSessionChannel ? (
                    <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs text-slate-600">{CHANNEL_LABELS[selectedLead.sourceChannel]} is template-only</span>
                    </div>
                  ) : null}

                  {/* Mode toggle + composer (non-email channels only) */}
                  {selectedLead.sourceChannel !== "email" && <div className="p-3">
                    {/* Reply / Note toggle */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <button
                        onClick={() => setComposerMode("reply")}
                        className={cn(
                          "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                          composerMode === "reply" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                        )}
                      >
                        <Send className="w-3 h-3" /> Reply
                      </button>
                      <button
                        onClick={() => setComposerMode("note")}
                        className={cn(
                          "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                          composerMode === "note" ? "bg-amber-100 text-amber-800 border-amber-300" : "border-border text-muted-foreground hover:border-amber-300"
                        )}
                      >
                        <StickyNote className="w-3 h-3" /> Note
                      </button>
                    </div>

                    {sendError && (
                      <div className="mb-2 text-xs text-destructive bg-destructive/10 rounded px-2 py-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> {sendError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Textarea
                        placeholder={
                          composerMode === "note"
                            ? "Add an internal note (only visible to team)…"
                            : canFreeText
                              ? "Type a message… (session is open)"
                              : "Free text unavailable — use template or note"
                        }
                        className={cn(
                          "flex-1 min-h-[60px] max-h-32 text-sm resize-none",
                          composerMode === "note" && "bg-amber-50/50 border-amber-200 focus-visible:ring-amber-300"
                        )}
                        value={composerText}
                        disabled={composerMode === "reply" && !canFreeText && !isBlocked ? !canFreeText : isBlocked}
                        onChange={e => setComposerText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey && (canFreeText || composerMode === "note")) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <div className="flex flex-col gap-1.5">
                        {(canFreeText || composerMode === "note") && (
                          <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={isSending || !composerText.trim()}
                            className={cn("h-7 px-2.5", composerMode === "note" && "bg-amber-500 hover:bg-amber-600")}
                          >
                            {composerMode === "note" ? <StickyNote className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        {composerMode === "reply" && !isBlocked && (
                          <>
                            <Button
                              size="sm" variant="outline"
                              onClick={() => setShowTemplatePicker(true)}
                              className="h-7 px-2 text-xs gap-1"
                              title="Use template"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            {quickReplies.length > 0 && (
                              <div className="relative">
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                                  className="h-7 px-2"
                                  title="Quick replies"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </Button>
                                {showQuickReplies && (
                                  <div className="absolute right-0 bottom-full mb-1 w-72 bg-card border rounded-lg shadow-lg z-50 p-2 space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground px-1 pb-1">Quick Replies</p>
                                    {quickReplies.map(qr => (
                                      <button
                                        key={qr.id}
                                        className="w-full text-left text-xs p-2 rounded hover:bg-muted transition-colors"
                                        onClick={() => { setComposerText(qr.text); setShowQuickReplies(false); }}
                                      >
                                        {qr.text.slice(0, 80)}{qr.text.length > 80 ? "…" : ""}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>}
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
                <div className="space-y-4">
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
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-muted-foreground">UHID</p>
                        <div className="flex items-center gap-1">
                          <p className="font-medium font-mono text-xs">{selectedLead.uhid}</p>
                          <button onClick={handleCopyUhid} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedLead.specialization && (
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-muted-foreground">Specialisation</p>
                        <p className="font-medium">{selectedLead.specialization}</p>
                      </div>
                    )}
                    {selectedLead.sourceListTag && (
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-muted-foreground">Source List</p>
                        <span className="inline-block text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                          {selectedLead.sourceListTag}
                        </span>
                      </div>
                    )}
                    {selectedLead.lastVisitDate && (
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-muted-foreground">Last Visit</p>
                        <p className="font-medium text-xs">{selectedLead.lastVisitDate}</p>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Owner</p>
                      <p className="font-medium text-xs truncate">{selectedLead.ownerName || "Unassigned"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Lead Age</p>
                      {selectedLead.createdAt ? (
                        <p className={cn("font-medium text-xs",
                          differenceInHours(new Date(), new Date(selectedLead.createdAt)) > 24 && selectedLead.status === "new" ? "text-orange-600" : ""
                        )}>
                          {formatDistanceToNow(new Date(selectedLead.createdAt))}
                          {differenceInHours(new Date(), new Date(selectedLead.createdAt)) > 24 && selectedLead.status === "new" && " ⚠️"}
                        </p>
                      ) : (
                        <p className="font-medium text-xs text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>

                  {/* Consent badges */}
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className={cn("px-2 py-0.5 rounded-full border",
                      selectedLead.optedIn ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700")}>
                      {selectedLead.optedIn ? "✓ Opted In" : "✗ Opted Out"}
                    </span>
                    {selectedLead.dndListed && (
                      <span className="px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700">DND</span>
                    )}
                  </div>

                  {/* Module lifecycle stepper */}
                  {MODULE_CHANNELS.includes(selectedLead.sourceChannel) && (() => {
                    const stages = MODULE_STAGES[selectedLead.sourceChannel] ?? [];
                    const currentIdx = selectedLead.moduleStage ? stages.indexOf(selectedLead.moduleStage) : -1;
                    const nextStage = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
                    return (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Lifecycle</p>
                        <div className="space-y-1.5">
                          {stages.map((stage, idx) => {
                            const isDone = currentIdx > idx;
                            const isCurrent = currentIdx === idx;
                            return (
                              <div key={stage} className="flex items-center gap-2">
                                <div className={cn(
                                  "w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold border",
                                  isDone ? "bg-green-500 border-green-500 text-white" :
                                  isCurrent ? "bg-primary border-primary text-primary-foreground" :
                                  "bg-background border-border text-muted-foreground"
                                )}>
                                  {isDone ? "✓" : idx + 1}
                                </div>
                                <span className={cn(
                                  "text-xs flex-1",
                                  isCurrent ? "font-semibold text-foreground" :
                                  isDone ? "text-muted-foreground line-through" :
                                  "text-muted-foreground"
                                )}>
                                  {MODULE_STAGE_LABELS[stage] || stage}
                                </span>
                                {isCurrent && (
                                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Now</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {nextStage && selectedLead.status !== "fulfilled" && (
                          <Button size="sm" variant="outline"
                            className="mt-3 h-7 text-xs w-full gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => { setPendingStage(nextStage); setShowStageDialog(true); }}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Advance to {MODULE_STAGE_LABELS[nextStage] || nextStage}
                          </Button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Transaction context */}
                  {selectedLead.transactionContext && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Order Detail</p>
                      <div className="bg-muted/50 rounded-lg p-2.5 space-y-1.5">
                        {Object.entries(selectedLead.transactionContext).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                            <span className="font-medium">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</p>
                      {addableTags.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setShowAddTag(!showAddTag)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {showAddTag && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-card border rounded-lg shadow-lg z-50 p-1.5 space-y-0.5">
                              {addableTags.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => handleToggleTag(t.name)}
                                  className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted text-left"
                                >
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {currentTags.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tags</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {currentTags.map(tag => (
                          <TagPill
                            key={tag}
                            name={tag}
                            color={tagColorMap[tag]}
                            onRemove={() => handleToggleTag(tag)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Activity log */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</h4>
                    </div>
                    {/* Filter chips */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(["all", "message", "status_change", "assignment", "note", "call", "stage_change"] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setActivityFilter(f)}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                            activityFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                          )}
                        >
                          {f === "all" ? "All" : f === "status_change" ? "Status" : f === "stage_change" ? "Stage" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {filteredActivity.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No activity</p>
                      ) : (
                        [...filteredActivity].reverse().map(entry => (
                          <div key={entry.id} className={cn(
                            "relative pl-3 border-l-2 pb-2 last:pb-0",
                            entry.type === "note" ? "border-amber-300" :
                            entry.type === "call" ? "border-green-300" :
                            entry.type === "stage_change" ? "border-indigo-300" :
                            "border-primary/20"
                          )}>
                            <div className={cn(
                              "absolute w-1.5 h-1.5 rounded-full -left-1 top-1",
                              entry.type === "note" ? "bg-amber-400" :
                              entry.type === "call" ? "bg-green-400" :
                              entry.type === "stage_change" ? "bg-indigo-400" :
                              "bg-primary/40"
                            )} />
                            <p className="text-xs font-medium capitalize flex items-center gap-1">
                              {entry.type === "note" && <StickyNote className="w-3 h-3 text-amber-500" />}
                              {entry.type === "call" && <PhoneCall className="w-3 h-3 text-green-600" />}
                              {entry.type === "stage_change" && <ArrowRight className="w-3 h-3 text-indigo-500" />}
                              {entry.type.replace(/_/g, " ")}
                            </p>
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
            <DialogTitle>Use a Template</DialogTitle>
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
                      <span className="text-xs text-muted-foreground">₹{(parseFloat(tpl.perMessageCost) * 1.05 * 1.18).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{tpl.body}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Call Modal ─────────────────────────────────────── */}
      <Dialog open={showCallModal} onOpenChange={(o) => {
        if (!o) {
          if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
          setShowCallModal(false);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-green-600" />
              {selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}` : "Call"}
            </DialogTitle>
          </DialogHeader>
          {callStep === "ringing" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                <Phone className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">Ringing {selectedLead?.mobile}…</p>
            </div>
          )}
          {callStep === "outcome" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground text-center">What was the outcome?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1.5 text-xs h-10 border-green-300 text-green-700 hover:bg-green-50" onClick={handleCallConnect}>
                  <PhoneCall className="w-3.5 h-3.5" /> Connected
                </Button>
                <Button variant="outline" className="gap-1.5 text-xs h-10" onClick={() => handleCallOutcomeSelect("no_answer")}>
                  <PhoneMissed className="w-3.5 h-3.5" /> No Answer
                </Button>
                <Button variant="outline" className="gap-1.5 text-xs h-10" onClick={() => handleCallOutcomeSelect("wrong_number")}>
                  <PhoneOff className="w-3.5 h-3.5" /> Wrong No.
                </Button>
                <Button variant="outline" className="gap-1.5 text-xs h-10" onClick={() => handleCallOutcomeSelect("voicemail")}>
                  <Voicemail className="w-3.5 h-3.5" /> Voicemail
                </Button>
              </div>
            </div>
          )}
          {callStep === "connected" && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <PhoneCall className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex items-center gap-1.5 text-sm font-mono font-semibold text-green-700">
                  <TimerIcon className="w-4 h-4" />
                  {String(Math.floor(callConnectedSecs / 60)).padStart(2, "0")}:{String(callConnectedSecs % 60).padStart(2, "0")}
                </div>
                <p className="text-xs text-muted-foreground">Call in progress</p>
              </div>
              <Button variant="destructive" className="w-full gap-1.5" onClick={handleCallEnd}>
                <PhoneOff className="w-4 h-4" /> End Call
              </Button>
            </div>
          )}
          {callStep === "done" && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg">
                {callOutcome === "connected" ? <PhoneCall className="w-4 h-4 text-green-600" /> :
                  callOutcome === "no_answer" ? <PhoneMissed className="w-4 h-4 text-amber-500" /> :
                  callOutcome === "voicemail" ? <Voicemail className="w-4 h-4 text-blue-500" /> :
                  <PhoneOff className="w-4 h-4 text-red-500" />}
                <div>
                  <p className="text-xs font-semibold capitalize">{callOutcome?.replace(/_/g, " ")}</p>
                  {callOutcome === "connected" && (
                    <p className="text-[10px] text-muted-foreground">
                      Duration: {String(Math.floor(callConnectedSecs / 60)).padStart(2, "0")}:{String(callConnectedSecs % 60).padStart(2, "0")}
                    </p>
                  )}
                </div>
              </div>
              <Textarea
                placeholder="Add a note (optional)…"
                className="min-h-[64px] text-sm resize-none"
                value={callNote}
                onChange={e => setCallNote(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCallModal(false)}>Discard</Button>
                <Button size="sm" onClick={handleCallSave}>Save Call</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Stage Advance Dialog ───────────────────────────── */}
      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-600" /> Advance Stage
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Move this lead to <strong className="text-foreground">{MODULE_STAGE_LABELS[pendingStage ?? ""] || pendingStage}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowStageDialog(false); setPendingStage(null); }}>Cancel</Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => pendingStage && handleAdvanceStage(pendingStage)}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Group into Segment Dialog ─────────────────────── */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Group into Segment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Create a named segment from the {bulkSelected.size} selected leads.</p>
            <Input
              placeholder="Segment name…"
              value={segmentName}
              onChange={e => setSegmentName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSegmentDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleGroupSegment} disabled={!segmentName.trim()}>Create Segment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
