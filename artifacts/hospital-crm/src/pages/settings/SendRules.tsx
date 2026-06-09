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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Send Rules</h1>
          <p className="text-muted-foreground mt-1">Configure compliance and frequency capping for campaigns.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5"/> Communication Window</CardTitle>
            <CardDescription>Restrict promotional messages to specific hours (TRAI Guidelines).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Time (IST)</label>
                <Input 
                  type="time" 
                  value={formData.sendWindowStart} 
                  onChange={e => setFormData({...formData, sendWindowStart: e.target.value})}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Time (IST)</label>
                <Input 
                  type="time" 
                  value={formData.sendWindowEnd} 
                  onChange={e => setFormData({...formData, sendWindowEnd: e.target.value})}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            
            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium text-foreground block">Frequency Capping</label>
              <CardDescription className="mb-2">Maximum number of messages a single patient can receive per 24 hours across all channels.</CardDescription>
              <div className="flex items-center gap-2 max-w-xs">
                <Input 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={formData.frequencyCap} 
                  onChange={e => setFormData({...formData, frequencyCap: parseInt(e.target.value)})}
                  disabled={!isAdmin}
                />
                <span className="text-sm text-muted-foreground">messages / day</span>
              </div>
            </div>

            {isAdmin && (
              <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} disabled={updateRules.isPending}>
                  {updateRules.isPending ? "Saving..." : "Save Rules"}
                </Button>
              </div>
            )}
            
            {!isAdmin && (
              <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground mt-4">
                You are viewing these rules in read-only mode. Only Affordplan Admins can modify compliance rules.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
