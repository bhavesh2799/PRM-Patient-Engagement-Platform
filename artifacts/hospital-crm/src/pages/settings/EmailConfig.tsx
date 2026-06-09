import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetSessionRole } from "@workspace/api-client-react";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, CheckCircle2, AlertTriangle, Info } from "lucide-react";

const PROVIDERS = [
  { value: "ses", label: "AWS SES" },
  { value: "sendgrid", label: "SendGrid" },
  { value: "mailgun", label: "Mailgun" },
  { value: "smtp", label: "Custom SMTP" },
];

export default function EmailConfig() {
  const { data: session } = useGetSessionRole();
  const isAdmin = session?.role === "ap_admin";

  const [form, setForm] = useState({
    provider: "ses",
    fromEmail: "noreply@sunrisehospital.in",
    fromName: "Sunrise Hospital",
    replyTo: "info@sunrisehospital.in",
    smtpHost: "email-smtp.ap-south-1.amazonaws.com",
    smtpPort: "587",
    smtpUser: "AKIAIOSFODNN7EXAMPLE",
    smtpPassword: "••••••••••••••••••••",
    dailyLimit: "10000",
    trackOpens: true,
    trackClicks: true,
    unsubscribeFooter: true,
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleSave = () => {
    toast.success("Email configuration saved.");
  };

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult("success");
      toast.success("Test email sent to info@sunrisehospital.in — check your inbox.");
    }, 1800);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Configuration</h1>
          <p className="text-muted-foreground text-sm mt-0.5">SMTP / transactional email settings for campaigns and reminders.</p>
        </div>

        {/* Status card */}
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Email channel is <strong>Live</strong>. AWS SES is verified and sending. Daily limit: 10,000 emails.</span>
        </div>

        {/* ── PROVIDER ──────────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Provider
          </p>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email Provider</label>
                <div className="grid grid-cols-4 gap-2">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setForm(f => ({ ...f, provider: p.value }))}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors
                        ${form.provider === p.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent disabled:cursor-not-allowed"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── SENDER IDENTITY ───────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Sender Identity
          </p>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From Email Address</label>
                  <Input
                    value={form.fromEmail}
                    onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))}
                    disabled={!isAdmin}
                    placeholder="noreply@yourhospital.in"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Display Name (From)</label>
                  <Input
                    value={form.fromName}
                    onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))}
                    disabled={!isAdmin}
                    placeholder="Sunrise Hospital"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-sm font-medium">Reply-To Address</label>
                  <Input
                    value={form.replyTo}
                    onChange={e => setForm(f => ({ ...f, replyTo: e.target.value }))}
                    disabled={!isAdmin}
                    placeholder="info@yourhospital.in"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── SMTP CREDENTIALS ──────────────── */}
        {form.provider === "smtp" && (
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              SMTP Credentials
            </p>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium">SMTP Host</label>
                    <Input value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Port</label>
                    <Input value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: e.target.value }))} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">SMTP Username</label>
                    <Input value={form.smtpUser} onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))} disabled={!isAdmin} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-sm font-medium">SMTP Password</label>
                    <Input type="password" value={form.smtpPassword} onChange={e => setForm(f => ({ ...f, smtpPassword: e.target.value }))} disabled={!isAdmin} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* For SES — show region/ARN mock */}
        {form.provider === "ses" && (
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              AWS SES Settings
            </p>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Region</label>
                    <Input value="ap-south-1 (Mumbai)" disabled />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Daily Send Limit</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={form.dailyLimit}
                        onChange={e => setForm(f => ({ ...f, dailyLimit: e.target.value }))}
                        disabled={!isAdmin}
                        className="max-w-[120px]"
                      />
                      <span className="text-sm text-muted-foreground">emails / day</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">SMTP Username (Access Key)</label>
                    <Input value={form.smtpUser} disabled={!isAdmin} onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">SMTP Password (Secret)</label>
                    <Input type="password" value={form.smtpPassword} disabled={!isAdmin} onChange={e => setForm(f => ({ ...f, smtpPassword: e.target.value }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TRACKING & COMPLIANCE ─────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Tracking & Compliance
          </p>
          <Card>
            <CardContent className="p-5 space-y-3">
              {[
                { key: "trackOpens" as const, label: "Track Email Opens", sub: "Embed 1×1 tracking pixel in all emails" },
                { key: "trackClicks" as const, label: "Track Link Clicks", sub: "Rewrite links through click-tracking proxy" },
                { key: "unsubscribeFooter" as const, label: "Unsubscribe Footer", sub: "Append mandatory unsubscribe link (recommended)" },
              ].map(({ key, label, sub }) => (
                <div key={key} className="flex items-start justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form[key] ? "bg-primary" : "bg-muted-foreground/30"} disabled:cursor-not-allowed`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Compliance note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <span>All outbound email must include a functioning unsubscribe mechanism per CAN-SPAM and TRAI guidelines. Campaign suppressions are applied automatically at launch.</span>
        </div>

        {/* Actions */}
        {isAdmin ? (
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? "Sending test…" : "Send Test Email"}
              </Button>
              {testResult === "success" && (
                <span className="flex items-center gap-1.5 text-sm text-green-600">
                  <CheckCircle2 size={14} /> Test delivered
                </span>
              )}
              {testResult === "error" && (
                <span className="flex items-center gap-1.5 text-sm text-red-500">
                  <AlertTriangle size={14} /> Test failed
                </span>
              )}
            </div>
            <Button onClick={handleSave}>Save Configuration</Button>
          </div>
        ) : (
          <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
            You are viewing email configuration in read-only mode. Only Affordplan Admins can modify these settings.
          </div>
        )}

      </div>
    </AppLayout>
  );
}
