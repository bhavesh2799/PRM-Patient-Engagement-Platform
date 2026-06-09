import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListTemplates, useListTemplateRequests, useCreateTemplateRequest,
  useGetWallet, useGetSessionRole,
  getListTemplateRequestsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, MessageSquare, Smartphone, Mail, X, ChevronRight, AlertTriangle, Eye,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useLocation } from "wouter";

const GOALS = ["Appointment Reminder", "Win-back", "Promotional Offer", "Chronic Care", "Feedback"] as const;
const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Marathi", "Bengali"] as const;
const DATE_RANGES = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "All time", value: "all" },
];

const VARIABLE_CHIPS = [
  { label: "First Name", token: "first_name", fallback: "there" },
  { label: "Last Name", token: "last_name", fallback: "" },
  { label: "UHID", token: "uhid", fallback: "" },
  { label: "Doctor Name", token: "doctor_name", fallback: "your doctor" },
  { label: "Specialisation", token: "specialization", fallback: "" },
  { label: "Appointment Date", token: "appointment_date", fallback: "your scheduled date" },
  { label: "Last Visit Date", token: "last_visit_date", fallback: "" },
];

const CHANNEL_LIMITS: Record<string, number> = { sms: 160, whatsapp: 1024, email: 100000 };

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  if (channel === "whatsapp") return <MessageSquare size={size} className="text-green-600" />;
  if (channel === "sms") return <Smartphone size={size} className="text-blue-600" />;
  if (channel === "email") return <Mail size={size} className="text-indigo-500" />;
  return <MessageSquare size={size} className="text-gray-400" />;
}

function ChannelLabel({ channel }: { channel: string }) {
  const map: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS", email: "Email" };
  return <span>{map[channel] ?? channel}</span>;
}

function QualityDot({ rating }: { rating?: string | null }) {
  if (!rating) return null;
  const colors: Record<string, string> = { Green: "bg-green-500", Yellow: "bg-yellow-400", Red: "bg-red-500" };
  const color = colors[rating] ?? "bg-gray-400";
  return (
    <span title={`Quality: ${rating}`} className={`inline-block w-2 h-2 rounded-full ${color}`} />
  );
}

// Channel-styled live preview
function ChannelPreview({ channel, body, sampleVars = 0 }: { channel: string; body: string; sampleVars?: number }) {
  const samples = [
    { first_name: "Priya", doctor_name: "Dr. Ananya Krishnan", appointment_date: "Mon 16 Jun, 10:00 AM", specialization: "Cardiology", uhid: "UHID-10001", last_visit_date: "15 Apr 2026" },
    { first_name: "Arjun", doctor_name: "Dr. Ramesh Nair", appointment_date: "Wed 18 Jun, 2:30 PM", specialization: "Orthopedics", uhid: "UHID-10002", last_visit_date: "3 Mar 2026" },
    { first_name: "Sunita", doctor_name: "Dr. Kavitha Reddy", appointment_date: "Thu 19 Jun, 11:00 AM", specialization: "Gynaecology", uhid: "UHID-10003", last_visit_date: "20 Feb 2026" },
  ];
  const vars = samples[sampleVars % samples.length];

  const rendered = body
    .replace(/\{first_name\}/g, vars.first_name)
    .replace(/\{last_name\}/g, "")
    .replace(/\{doctor_name\}/g, vars.doctor_name)
    .replace(/\{appointment_date\}/g, vars.appointment_date)
    .replace(/\{specialization\}/g, vars.specialization)
    .replace(/\{uhid\}/g, vars.uhid)
    .replace(/\{last_visit_date\}/g, vars.last_visit_date)
    .replace(/\{\{([^}|]+)\|"([^"]+)"\}\}/g, (_: string, __: string, fallback: string) => fallback)
    .replace(/\{\{([^}]+)\}\}/g, (_: string, name: string) => `[${name}]`)
    .replace(/\{([^}]+)\}/g, (_: string, name: string) => `[${name}]`);

  if (channel === "sms") {
    return (
      <div className="bg-gray-100 rounded-xl p-3 max-w-[300px] font-sans text-sm">
        <div className="text-xs text-gray-500 mb-2 font-medium">SUNRSE</div>
        <div className="bg-white rounded-lg p-3 shadow-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {rendered || <span className="text-gray-400 italic">Message will appear here…</span>}
        </div>
        <div className="text-xs text-gray-400 mt-1 text-right">
          {body.length}/{CHANNEL_LIMITS.sms} chars
          {body.length > CHANNEL_LIMITS.sms && <span className="text-orange-500 ml-1">({Math.ceil(body.length / 160)} parts)</span>}
        </div>
      </div>
    );
  }

  if (channel === "whatsapp") {
    return (
      <div className="bg-[#ECE5DD] rounded-xl p-3 max-w-[300px] font-sans text-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">S</div>
          <div>
            <div className="text-xs font-semibold text-gray-800">Sunrise Hospital</div>
            <div className="text-[10px] text-gray-500">Business Account</div>
          </div>
        </div>
        <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm text-gray-800 leading-relaxed whitespace-pre-wrap max-w-[260px]">
          {rendered || <span className="text-gray-400 italic">Message will appear here…</span>}
        </div>
        <div className="text-xs text-gray-400 mt-1 text-right">
          {body.length}/{CHANNEL_LIMITS.whatsapp} chars
        </div>
      </div>
    );
  }

  // Email
  return (
    <div className="bg-white border rounded-xl shadow-sm max-w-[300px] font-sans text-sm">
      <div className="bg-gray-50 border-b px-3 py-2 rounded-t-xl space-y-0.5">
        <div className="text-[10px] text-gray-500">
          From: <span className="font-medium text-gray-700">noreply@sunrisehospital.in</span>
        </div>
        <div className="text-[10px] text-gray-500">
          Subject: <span className="font-medium text-gray-700">Message from Sunrise Hospital</span>
        </div>
      </div>
      <div className="px-3 py-3 text-gray-800 leading-relaxed whitespace-pre-wrap text-xs min-h-[60px]">
        {rendered || <span className="text-gray-400 italic">Email body will appear here…</span>}
      </div>
    </div>
  );
}

// Stage tracker for pending requests
function StageTracker({ channel, stage }: { channel: string; stage: string }) {
  let stages: { key: string; label: string }[] = [];
  if (channel === "email") {
    stages = [
      { key: "ap_marketing", label: "AP Review" },
      { key: "live", label: "Live" },
    ];
  } else if (channel === "sms") {
    stages = [
      { key: "ap_marketing", label: "AP Review" },
      { key: "channel_compliance", label: "DLT Whitelist" },
      { key: "live", label: "Live" },
    ];
  } else {
    stages = [
      { key: "ap_marketing", label: "AP Review" },
      { key: "channel_compliance", label: "Meta Polling" },
      { key: "live", label: "Live" },
    ];
  }

  const isRejected = stage === "rejected";
  const currentIdx = isRejected ? -1 : stages.findIndex(s => s.key === stage);

  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => {
        const done = !isRejected && i < currentIdx;
        const active = !isRejected && i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border
              ${done ? "bg-green-100 border-green-400 text-green-700" :
                active ? "bg-blue-100 border-blue-400 text-blue-700" :
                  "bg-gray-50 border-gray-200 text-gray-400"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${done ? "bg-green-500" : active ? "bg-blue-500" : "bg-gray-300"}`} />
              {s.label}
            </div>
            {i < stages.length - 1 && <ChevronRight size={10} className="text-gray-300" />}
          </div>
        );
      })}
      {isRejected && (
        <span className="px-2 py-0.5 rounded-full bg-red-100 border border-red-300 text-red-700 text-[10px] font-medium">
          Rejected
        </span>
      )}
    </div>
  );
}

// Low-wallet banner
function LowWalletBanner({ balance }: { balance?: number }) {
  if (balance === undefined || balance >= 5000) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm">
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span>Wallet balance ₹{balance.toLocaleString("en-IN")} is below ₹5,000. <strong>Top up</strong> to avoid campaign interruptions.</span>
    </div>
  );
}

export default function Templates() {
  const { data: templates, isLoading: templatesLoading } = useListTemplates();
  const { data: requests, isLoading: requestsLoading } = useListTemplateRequests();
  const createRequest = useCreateTemplateRequest();
  const { data: wallet } = useGetWallet();
  const { data: session } = useGetSessionRole();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Filter state
  const [filterChannels, setFilterChannels] = useState<string[]>([]);
  const [filterGoal, setFilterGoal] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterDate, setFilterDate] = useState("all");

  // UI state
  type TplItem = NonNullable<typeof templates>[number];
  const [drawerTemplate, setDrawerTemplate] = useState<TplItem | null>(null);
  const [drawerSampleIdx, setDrawerSampleIdx] = useState(0);
  const [isRequestOpen, setIsRequestOpen] = useState(false);

  // Request form
  const [form, setForm] = useState({
    name: "",
    channel: "whatsapp" as "whatsapp" | "sms" | "push",
    goal: "Appointment Reminder",
    language: "English",
    message: "",
    media: "",
    notes: "",
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback((token: string, fallback: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? form.message.length;
    const end = ta.selectionEnd ?? form.message.length;
    const snippet = fallback ? `{{${token}|"${fallback}"}}` : `{${token}}`;
    const newMsg = form.message.slice(0, start) + snippet + form.message.slice(end);
    setForm(f => ({ ...f, message: newMsg }));
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + snippet.length;
      ta.selectionEnd = start + snippet.length;
    }, 10);
  }, [form.message]);

  // Apply filters
  const now = new Date();
  const filterDate_cutoff = filterDate === "all" ? null : subDays(now, Number(filterDate));

  const applyFilters = <T extends { channel: string; goal: string; language: string; createdAt?: string }>(items: T[]): T[] => {
    return items.filter(t => {
      if (filterChannels.length > 0 && !filterChannels.includes(t.channel)) return false;
      if (filterGoal && t.goal !== filterGoal) return false;
      if (filterLanguage && t.language !== filterLanguage) return false;
      if (filterDate_cutoff && t.createdAt && new Date(t.createdAt) < filterDate_cutoff) return false;
      return true;
    });
  };

  const approvedTemplates = applyFilters(
    (templates ?? []).filter(t => t.status === "approved")
  );

  const pendingRequests = applyFilters(
    (requests ?? []).map(r => ({ ...r, language: r.variables?.includes("Hindi") ? "Hindi" : "English" }))
  );

  const toggleChannel = (ch: string) => {
    setFilterChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const clearFilters = () => {
    setFilterChannels([]);
    setFilterGoal("");
    setFilterLanguage("");
    setFilterDate("all");
  };

  const hasFilters = filterChannels.length > 0 || filterGoal || filterLanguage || filterDate !== "all";

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.message) {
      toast.error("Please fill in all required fields");
      return;
    }
    createRequest.mutate(
      { data: { name: form.name, channel: form.channel, goal: form.goal, message: form.message } },
      {
        onSuccess: () => {
          toast.success("Template request submitted! Reviewed in 48h. WhatsApp templates can take an extra 24–72h for Meta approval.");
          setIsRequestOpen(false);
          setForm({ name: "", channel: "whatsapp", goal: "Appointment Reminder", language: "English", message: "", media: "", notes: "" });
          queryClient.invalidateQueries({ queryKey: getListTemplateRequestsQueryKey() });
        },
      }
    );
  };

  const handleUseInCampaign = (tpl: { id: number; channel: string }) => {
    setLocation(`/marketing/campaigns?template=${tpl.id}&channel=${tpl.channel}`);
  };

  return (
    <AppLayout>
      <div className="space-y-4 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Templates</h1>
            <p className="text-muted-foreground mt-1">Approved message templates for WhatsApp, SMS, and Push.</p>
          </div>
          <Button onClick={() => setIsRequestOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Request a new template
          </Button>
        </div>

        <LowWalletBanner balance={wallet ? parseFloat(String(wallet.balance)) : undefined} />

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center p-3 bg-muted/40 rounded-lg border">
          <div className="flex gap-1.5">
            {["whatsapp", "sms", "push"].map(ch => (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${filterChannels.includes(ch) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent"}`}
              >
                <ChannelIcon channel={ch} size={12} />
                <ChannelLabel channel={ch} />
              </button>
            ))}
          </div>
          <select
            className="h-8 px-3 rounded-md border border-input bg-background text-sm"
            value={filterGoal}
            onChange={e => setFilterGoal(e.target.value)}
          >
            <option value="">All Goals</option>
            {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            className="h-8 px-3 rounded-md border border-input bg-background text-sm"
            value={filterLanguage}
            onChange={e => setFilterLanguage(e.target.value)}
          >
            <option value="">All Languages</option>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select
            className="h-8 px-3 rounded-md border border-input bg-background text-sm"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          >
            {DATE_RANGES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">
              Clear filters
            </button>
          )}
        </div>

        <Tabs defaultValue="approved">
          <TabsList>
            <TabsTrigger value="approved">
              Approved
              <span className="ml-1.5 bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {approvedTemplates.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending Approval
              <span className="ml-1.5 bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {pendingRequests.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Approved tab */}
          <TabsContent value="approved" className="mt-4">
            {templatesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : approvedTemplates.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                No templates match your filters.{hasFilters && <button onClick={clearFilters} className="underline ml-1">Clear filters</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {approvedTemplates.map(tpl => (
                  <Card
                    key={tpl.id}
                    className="cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => { setDrawerTemplate(tpl); setDrawerSampleIdx(0); }}
                  >
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <ChannelIcon channel={tpl.channel} />
                          <ChannelLabel channel={tpl.channel} />
                          {tpl.channel === "whatsapp" && tpl.qualityRating && (
                            <QualityDot rating={tpl.qualityRating} />
                          )}
                          {tpl.channel === "whatsapp" && tpl.qualityRating === "Red" && (
                            <span className="text-red-500 text-[10px] font-semibold">Quality warning</span>
                          )}
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                          title="Preview"
                          onClick={e => { e.stopPropagation(); setDrawerTemplate(tpl); setDrawerSampleIdx(0); }}
                        >
                          <Eye size={14} className="text-muted-foreground" />
                        </button>
                      </div>

                      <div className="font-semibold text-sm mb-1">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                        {tpl.body}
                      </div>

                      <div className="flex flex-wrap gap-1 mt-3">
                        <Badge variant="secondary" className="text-[10px]">{tpl.goal}</Badge>
                        <Badge variant="outline" className="text-[10px]">{tpl.language}</Badge>
                        <Badge variant="outline" className="text-[10px]">₹{tpl.perMessageCost}/msg</Badge>
                      </div>

                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        onClick={e => { e.stopPropagation(); handleUseInCampaign(tpl); }}
                      >
                        Use in campaign
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pending Approval tab */}
          <TabsContent value="pending" className="mt-4">
            {requestsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded bg-muted animate-pulse" />)}</div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No pending template requests.</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Template Name</th>
                      <th className="text-left p-3 font-medium">Channel</th>
                      <th className="text-left p-3 font-medium">Goal</th>
                      <th className="text-left p-3 font-medium">Submitted</th>
                      <th className="text-left p-3 font-medium">Stage</th>
                      <th className="text-left p-3 font-medium">ETA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingRequests.map(req => {
                      const etaMap: Record<string, string> = {
                        ap_marketing: "~48h",
                        channel_compliance: req.channel === "whatsapp" ? "24–72h (Meta)" : "24–48h (DLT)",
                        live: "—",
                        rejected: "—",
                      };
                      return (
                        <tr key={req.id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <div className="font-medium">{req.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{req.message}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <ChannelIcon channel={req.channel} size={12} />
                              <ChannelLabel channel={req.channel} />
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{req.goal}</td>
                          <td className="p-3 text-muted-foreground">{format(new Date(req.createdAt), "d MMM")}</td>
                          <td className="p-3">
                            <StageTracker channel={req.channel} stage={req.approvalStage} />
                            {req.rejectionReason && (
                              <div className="text-xs text-red-500 mt-1">{req.rejectionReason}</div>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{etaMap[req.approvalStage] ?? "~48h"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Template Detail Drawer */}
      <Sheet open={!!drawerTemplate} onOpenChange={open => !open && setDrawerTemplate(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {drawerTemplate && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <ChannelIcon channel={drawerTemplate.channel} size={18} />
                  {drawerTemplate.name}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">{drawerTemplate.channel}</Badge>
                  <Badge variant="secondary">{drawerTemplate.goal}</Badge>
                  <Badge variant="outline">{drawerTemplate.language}</Badge>
                  <Badge className="bg-green-600">Approved</Badge>
                  {drawerTemplate.qualityRating && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <QualityDot rating={drawerTemplate.qualityRating} />
                      Quality: {drawerTemplate.qualityRating}
                    </Badge>
                  )}
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Channel Preview</div>
                  <ChannelPreview channel={drawerTemplate.channel} body={drawerTemplate.body} sampleVars={drawerSampleIdx} />
                  <div className="flex gap-2 mt-2">
                    {[0, 1, 2].map(i => (
                      <button
                        key={i}
                        onClick={() => setDrawerSampleIdx(i)}
                        className={`text-xs px-2 py-1 rounded border ${drawerSampleIdx === i ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                      >
                        Sample {i + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Variables in this template</div>
                  <div className="flex flex-wrap gap-2">
                    {VARIABLE_CHIPS.filter(v => drawerTemplate.body.includes(`{${v.token}}`)).map(v => (
                      <span key={v.token} className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                        {`{${v.token}}`}
                        {v.fallback && <span className="text-blue-400 ml-1">| "{v.fallback}"</span>}
                      </span>
                    ))}
                    {!VARIABLE_CHIPS.some(v => drawerTemplate.body.includes(`{${v.token}}`)) && (
                      <span className="text-xs text-muted-foreground">No variables</span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground border-t pt-3">
                  ₹{drawerTemplate.perMessageCost}/message · {drawerTemplate.scope === "global" ? "Shared library" : "Hospital template"}
                </div>

                <Button className="w-full" onClick={() => { handleUseInCampaign(drawerTemplate); setDrawerTemplate(null); }}>
                  Use in campaign
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Templates are use-as-is. To change the message, request a new template.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Request New Template Dialog */}
      <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a New Template</DialogTitle>
            <p className="text-sm text-muted-foreground">Reviewed in 48h. WhatsApp templates take an extra 24–72h for Meta approval.</p>
          </DialogHeader>

          <form onSubmit={handleRequestSubmit} className="mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: form fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Template Name *</label>
                  <Input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Post-Surgery Follow-up"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Channel *</label>
                  <div className="flex gap-3">
                    {(["whatsapp", "sms", "push"] as const).map(ch => (
                      <label key={ch} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors
                        ${form.channel === ch ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
                        <input
                          type="radio"
                          name="channel"
                          value={ch}
                          checked={form.channel === ch}
                          onChange={() => setForm(f => ({ ...f, channel: ch }))}
                          className="sr-only"
                        />
                        <ChannelIcon channel={ch} size={14} />
                        <span className="text-sm capitalize"><ChannelLabel channel={ch} /></span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Campaign Goal *</label>
                    <select
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                      value={form.goal}
                      onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                    >
                      {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Language *</label>
                    <select
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                      value={form.language}
                      onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                    >
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Variable Chips</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLE_CHIPS.map(v => (
                      <button
                        type="button"
                        key={v.token}
                        onClick={() => insertVariable(v.token, v.fallback)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md text-xs text-blue-700 font-medium transition-colors"
                      >
                        + {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Message Body *</label>
                  <Textarea
                    ref={textareaRef}
                    required
                    rows={6}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder={form.channel === "push" ? "Tap-worthy notification text…" : "Dear {first_name}, your appointment…"}
                    className="font-mono text-sm"
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {form.message.length} / {CHANNEL_LIMITS[form.channel]} chars
                    {form.message.length > CHANNEL_LIMITS[form.channel] && (
                      <span className="text-orange-500 ml-1 font-medium">Over limit!</span>
                    )}
                  </div>
                </div>

                {form.channel !== "sms" && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Media URL <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      value={form.media}
                      onChange={e => setForm(f => ({ ...f, media: e.target.value }))}
                      placeholder={form.channel === "whatsapp" ? "Image / document / video URL" : "Image URL"}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Notes for AP Ops <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Textarea
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Context for the Affordplan marketing team…"
                  />
                </div>
              </div>

              {/* Right: live preview */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Live Preview</div>
                <ChannelPreview channel={form.channel} body={form.message} />
                <p className="text-xs text-muted-foreground">
                  Variables show sample values. Tokens like <code className="bg-muted px-1 rounded">{"{first_name}"}</code> are replaced at send time.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsRequestOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRequest.isPending}>
                {createRequest.isPending ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
