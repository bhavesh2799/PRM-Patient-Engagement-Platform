import { AppLayout } from "@/components/layout/AppLayout";
import { useGetChannelConfig } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Smartphone, Mail, Phone, BarChart3, Database, Bell, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

const STATUS_STYLES: Record<string, string> = {
  live:           "bg-green-100 text-green-700",
  pending:        "bg-blue-100 text-blue-700",
  error:          "bg-red-100 text-red-700",
  not_configured: "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  const label = status === "live" ? "Live"
    : status === "pending" ? "Pending"
    : status === "error" ? "Error"
    : "Not configured";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.not_configured}`}>
      {label}
    </span>
  );
}

function SyncBadge({ minsAgo }: { minsAgo: number }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
      <RefreshCw size={9} />
      <span>Synced {minsAgo} min ago</span>
    </div>
  );
}

export default function Integrations() {
  const { data: config, isLoading } = useGetChannelConfig();
  const [, navigate] = useLocation();

  const whatsapp = config?.channels?.find(c => c.type === "whatsapp");
  const sms      = config?.channels?.find(c => c.type === "sms");

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Integrations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Communication channels and platform connectors.</p>
        </div>

        {/* ── ACTIVE CHANNELS ─────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Active Channels
          </p>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* 1. WhatsApp WABA */}
              <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/super-admin/channels")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <StatusBadge status={whatsapp?.status ?? "not_configured"} />
                  </div>
                  <p className="font-semibold text-sm mb-1">WhatsApp (WABA)</p>
                  <p className="text-xs text-muted-foreground mb-3">WhatsApp Business API for outbound campaigns and patient replies.</p>
                  {whatsapp?.wabaNumbers?.length ? (
                    <div className="space-y-1 pt-2 border-t">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Active Numbers</p>
                      {whatsapp.wabaNumbers.map((w, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="font-mono text-xs">{w.number}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{w.ownership}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <SyncBadge minsAgo={3} />
                </CardContent>
              </Card>

              {/* 2. SMS */}
              <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/super-admin/channels")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-blue-600" />
                    </div>
                    <StatusBadge status={sms?.status ?? "not_configured"} />
                  </div>
                  <p className="font-semibold text-sm mb-1">SMS</p>
                  <p className="text-xs text-muted-foreground mb-3">TRAI-compliant DLT-registered transactional and promotional SMS.</p>
                  {sms?.smsHeaders?.length ? (
                    <div className="space-y-1 pt-2 border-t">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Approved Headers</p>
                      {sms.smsHeaders.map((h, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="font-mono text-xs">{h.value}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{h.ownership}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <SyncBadge minsAgo={3} />
                </CardContent>
              </Card>

              {/* 3. Push */}
              <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/super-admin/channels")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-orange-600" />
                    </div>
                    <StatusBadge status="live" />
                  </div>
                  <p className="font-semibold text-sm mb-1">Push Notifications</p>
                  <p className="text-xs text-muted-foreground mb-3">In-app and browser push notifications for campaigns.</p>
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Configuration</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Partner</span>
                      <span className="text-xs font-medium">NotifyVisitors</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Workspace ID</span>
                      <span className="text-xs font-mono">NV-SRH-0041</span>
                    </div>
                  </div>
                  <SyncBadge minsAgo={5} />
                </CardContent>
              </Card>

              {/* 4. Calling */}
              <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/super-admin/channels")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-teal-600" />
                    </div>
                    <StatusBadge status="live" />
                  </div>
                  <p className="font-semibold text-sm mb-1">Calling / IVR</p>
                  <p className="text-xs text-muted-foreground mb-3">Outbound call capability with outcome logging on every lead.</p>
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Caller IDs</p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">+91 80-4521-7890</span>
                      <span className="text-[10px] text-amber-600 font-medium">★ Default</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">+91 80-4521-7891</span>
                      <span className="text-[10px] text-muted-foreground">Backup</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">Provider</span>
                      <span className="text-xs font-medium">Knowlarity</span>
                    </div>
                  </div>
                  <SyncBadge minsAgo={8} />
                </CardContent>
              </Card>

              {/* 5. Email */}
              <Card className="cursor-pointer hover:border-foreground/30 transition-colors" onClick={() => navigate("/settings/email-config")}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-indigo-600" />
                    </div>
                    <StatusBadge status="live" />
                  </div>
                  <p className="font-semibold text-sm mb-1">Email</p>
                  <p className="text-xs text-muted-foreground mb-3">SMTP-based email for appointment reminders, reports, and campaigns.</p>
                  <div className="space-y-1 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Provider</span>
                      <span className="text-xs font-medium">AWS SES</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">From</span>
                      <span className="text-xs font-mono truncate max-w-[130px]">noreply@sunrisehospital.in</span>
                    </div>
                  </div>
                  <SyncBadge minsAgo={2} />
                </CardContent>
              </Card>

            </div>
          )}
        </div>

        {/* ── COMING IN PHASE 2 ─────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Coming in Phase 2
          </p>
          <div className="grid grid-cols-2 gap-3 opacity-50 pointer-events-none">
            {[
              { icon: BarChart3, label: "Google / Meta Ads",    sub: "Retargeting & lookalikes" },
              { icon: Database,  label: "HIS Live Integration", sub: "Real-time patient sync" },
            ].map(({ icon: Icon, label, sub }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
