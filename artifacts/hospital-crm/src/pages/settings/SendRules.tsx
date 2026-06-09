import { AppLayout } from "@/components/layout/AppLayout";
import { useGetSendRules, useUpdateSendRules, useGetSessionRole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";

export default function SendRules() {
  const { data: rules, isLoading } = useGetSendRules();
  const { data: session } = useGetSessionRole();
  const updateRules = useUpdateSendRules();

  const [formData, setFormData] = useState({
    sendWindowStart: "09:00",
    sendWindowEnd: "21:00",
    frequencyCap: 3
  });

  useEffect(() => {
    if (rules) {
      setFormData({
        sendWindowStart: rules.sendWindowStart,
        sendWindowEnd: rules.sendWindowEnd,
        frequencyCap: rules.frequencyCap
      });
    }
  }, [rules]);

  const isAdmin = session?.role === "ap_admin";

  const handleSave = () => {
    updateRules.mutate(
      { data: formData },
      { onSuccess: () => toast.success("Send rules updated successfully") }
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Send Rules</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Compliance and frequency capping for outbound campaigns.</p>
        </div>

        {/* ── SEND WINDOW ───────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            TRAI Send Window
          </p>
          <Card>
            <CardContent className="p-5 space-y-5">
              <p className="text-sm text-muted-foreground">
                Promotional messages are blocked outside this window per TRAI Guidelines. Window is enforced in IST (Asia/Kolkata).
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Start Time (IST)</label>
                  <Input
                    type="time"
                    value={formData.sendWindowStart}
                    onChange={e => setFormData({ ...formData, sendWindowStart: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">End Time (IST)</label>
                  <Input
                    type="time"
                    value={formData.sendWindowEnd}
                    onChange={e => setFormData({ ...formData, sendWindowEnd: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Current window: <strong className="text-foreground">{formData.sendWindowStart} – {formData.sendWindowEnd} IST</strong></span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── FREQUENCY CAP ─────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Frequency Capping
          </p>
          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Maximum messages a single patient can receive per 24 hours across all channels combined.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.frequencyCap}
                  onChange={e => setFormData({ ...formData, frequencyCap: parseInt(e.target.value) })}
                  disabled={!isAdmin}
                  className="max-w-[100px]"
                />
                <span className="text-sm text-muted-foreground">messages / patient / day</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {isAdmin ? (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateRules.isPending}>
              {updateRules.isPending ? "Saving…" : "Save Rules"}
            </Button>
          </div>
        ) : (
          <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
            Read-only mode — only Affordplan Admins can modify compliance rules.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
