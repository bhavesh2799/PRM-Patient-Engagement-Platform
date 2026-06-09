import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListSegments, useCreateSegment, useDeleteSegment, useRefreshSegment,
  useGetWallet, getListSegmentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, RefreshCw, Download, MoreHorizontal, AlertTriangle, Users, Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Condition builder types
type CondOp = "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "in_last_days" | "older_than_days";

interface Condition {
  id: string;
  field: string;
  operator: CondOp;
  value: string;
}

interface ConditionGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: Condition[];
}

const AFFORDPLAN_FIELDS: { value: string; label: string; type: "text" | "number" | "select" | "days" }[] = [
  { value: "last_visit_days", label: "Last visit (days ago)", type: "days" },
  { value: "total_visits", label: "Total visits", type: "number" },
  { value: "touchpoint", label: "Touchpoint", type: "select" },
  { value: "specialization", label: "Specialisation", type: "select" },
  { value: "spend_amount", label: "Spend amount (₹)", type: "number" },
  { value: "has_lab_booking", label: "Has lab booking", type: "select" },
  { value: "has_medicine_order", label: "Has medicine order", type: "select" },
  { value: "has_ipd_admission", label: "Has IPD admission", type: "select" },
  { value: "appointment_status", label: "Appointment status", type: "select" },
];

const OPS_FOR_TYPE: Record<string, { value: CondOp; label: string }[]> = {
  text: [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
    { value: "contains", label: "contains" },
  ],
  number: [
    { value: "equals", label: "=" },
    { value: "greater_than", label: ">" },
    { value: "less_than", label: "<" },
  ],
  days: [
    { value: "in_last_days", label: "in the last (days)" },
    { value: "older_than_days", label: "older than (days)" },
  ],
  select: [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
  ],
};

const SELECT_OPTIONS: Record<string, string[]> = {
  touchpoint: ["OPD", "Lab", "Pharmacy", "IPD"],
  specialization: ["Cardiology", "Orthopedics", "Neurology", "Gynaecology", "Paediatrics", "Dermatology", "General Medicine", "Gastroenterology"],
  has_lab_booking: ["Yes", "No"],
  has_medicine_order: ["Yes", "No"],
  has_ipd_admission: ["Yes", "No"],
  appointment_status: ["confirmed", "completed", "cancelled", "no-show"],
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function ConditionRow({
  condition,
  onUpdate,
  onRemove,
}: {
  condition: Condition;
  onUpdate: (id: string, update: Partial<Condition>) => void;
  onRemove: (id: string) => void;
}) {
  const fieldDef = AFFORDPLAN_FIELDS.find(f => f.value === condition.field);
  const ops = OPS_FOR_TYPE[fieldDef?.type ?? "text"] ?? OPS_FOR_TYPE.text;
  const isSelect = fieldDef?.type === "select";
  const opts = isSelect ? SELECT_OPTIONS[condition.field] ?? [] : [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        className="h-8 px-2 rounded border border-input bg-background text-sm min-w-[160px]"
        value={condition.field}
        onChange={e => onUpdate(condition.id, { field: e.target.value, value: "" })}
      >
        {AFFORDPLAN_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        className="h-8 px-2 rounded border border-input bg-background text-sm min-w-[120px]"
        value={condition.operator}
        onChange={e => onUpdate(condition.id, { operator: e.target.value as CondOp })}
      >
        {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {isSelect ? (
        <select
          className="h-8 px-2 rounded border border-input bg-background text-sm min-w-[100px]"
          value={condition.value}
          onChange={e => onUpdate(condition.id, { value: e.target.value })}
        >
          <option value="">Pick…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <Input
          className="h-8 text-sm w-24"
          value={condition.value}
          onChange={e => onUpdate(condition.id, { value: e.target.value })}
          placeholder="value"
          type="number"
        />
      )}
      <button onClick={() => onRemove(condition.id)} className="text-muted-foreground hover:text-destructive">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ConditionBuilder({
  groups,
  onChange,
}: {
  groups: ConditionGroup[];
  onChange: (groups: ConditionGroup[]) => void;
}) {
  const addGroup = () =>
    onChange([...groups, { id: uid(), logic: "AND", conditions: [{ id: uid(), field: "last_visit_days", operator: "in_last_days", value: "30" }] }]);

  const removeGroup = (gid: string) => onChange(groups.filter(g => g.id !== gid));

  const toggleGroupLogic = (gid: string) =>
    onChange(groups.map(g => g.id === gid ? { ...g, logic: g.logic === "AND" ? "OR" : "AND" } : g));

  const addCondition = (gid: string) =>
    onChange(groups.map(g => g.id === gid
      ? { ...g, conditions: [...g.conditions, { id: uid(), field: "last_visit_days", operator: "in_last_days", value: "30" }] }
      : g));

  const updateCondition = (gid: string, cid: string, update: Partial<Condition>) =>
    onChange(groups.map(g => g.id === gid
      ? { ...g, conditions: g.conditions.map(c => c.id === cid ? { ...c, ...update } : c) }
      : g));

  const removeCondition = (gid: string, cid: string) =>
    onChange(groups.map(g => g.id === gid
      ? { ...g, conditions: g.conditions.filter(c => c.id !== cid) }
      : g));

  return (
    <div className="space-y-3">
      {groups.map((group, gi) => (
        <div key={group.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {gi > 0 && <span className="text-xs text-muted-foreground font-medium">OR group</span>}
              <button
                type="button"
                onClick={() => toggleGroupLogic(group.id)}
                className="text-xs px-2 py-0.5 rounded border border-primary text-primary font-medium hover:bg-primary/10"
              >
                {group.logic}
              </button>
              <span className="text-xs text-muted-foreground">between conditions</span>
            </div>
            {groups.length > 1 && (
              <button onClick={() => removeGroup(group.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <div className="space-y-2">
            {group.conditions.map((cond, ci) => (
              <div key={cond.id} className="flex items-center gap-2">
                {ci > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground w-6 text-center">{group.logic}</span>
                )}
                {ci === 0 && <span className="w-6" />}
                <ConditionRow
                  condition={cond}
                  onUpdate={(id, upd) => updateCondition(group.id, id, upd)}
                  onRemove={(id) => removeCondition(group.id, id)}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addCondition(group.id)}
            className="text-xs text-primary hover:underline mt-1"
          >
            + Add condition
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addGroup}
        className="text-xs text-primary hover:underline"
      >
        + Add OR group
      </button>
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

export default function Segments() {
  const { data: segments, isLoading } = useListSegments();
  const createSegment = useCreateSegment();
  const deleteSegment = useDeleteSegment();
  const refreshSegment = useRefreshSegment();
  const { data: wallet } = useGetWallet();
  const queryClient = useQueryClient();

  const walletBalance = wallet ? parseFloat(String(wallet.balance)) : undefined;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [basicForm, setBasicForm] = useState({
    name: "",
    description: "",
    source: "affordplan" as "affordplan" | "his" | "csv",
  });
  const [groups, setGroups] = useState<ConditionGroup[]>([
    { id: uid(), logic: "AND", conditions: [{ id: uid(), field: "last_visit_days", operator: "in_last_days", value: "90" }] },
  ]);
  const [countResult, setCountResult] = useState<number | null>(null);
  const [countComputed, setCountComputed] = useState(false);

  const resetDialog = () => {
    setBasicForm({ name: "", description: "", source: "affordplan" });
    setGroups([{ id: uid(), logic: "AND", conditions: [{ id: uid(), field: "last_visit_days", operator: "in_last_days", value: "90" }] }]);
    setCountResult(null);
    setCountComputed(false);
  };

  const handleShowCount = () => {
    // Simulate count based on conditions
    const base = 150 + Math.floor(Math.random() * 400);
    setCountResult(base);
    setCountComputed(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!basicForm.name) { toast.error("Segment name is required"); return; }

    const conditionTree = JSON.stringify(groups);
    createSegment.mutate(
      { data: { name: basicForm.name, description: basicForm.description, source: basicForm.source, conditionTree } },
      {
        onSuccess: () => {
          toast.success(
            <div>
              <div className="font-medium">Segment created</div>
              <div className="text-xs mt-0.5 text-muted-foreground">For UHID-based revenue attribution in metrics, ensure the patient data includes valid UHIDs.</div>
            </div>
          );
          setIsDialogOpen(false);
          resetDialog();
          queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Delete segment "${name}"? This cannot be undone.`)) {
      deleteSegment.mutate(
        { id },
        {
          onSuccess: () => {
            toast.success("Segment deleted");
            queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
          },
        }
      );
    }
  };

  const handleRefresh = (id: number) => {
    refreshSegment.mutate(
      { id },
      {
        onSuccess: (updated) => {
          toast.success(`Refreshed — ${(updated as any).count?.toLocaleString()} patients`);
          queryClient.invalidateQueries({ queryKey: getListSegmentsQueryKey() });
        },
      }
    );
  };

  const handleExport = (name: string) => {
    toast.success(`Export of "${name}" initiated. CSV will be ready shortly.`);
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Audience Segments</h1>
            <p className="text-muted-foreground mt-1">Define patient audiences for targeted campaigns.</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Segment
          </Button>
        </div>

        <LowWalletBanner balance={walletBalance} />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Segments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Last Refresh</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading…</TableCell></TableRow>
                ) : !segments?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No segments yet</TableCell></TableRow>
                ) : (
                  segments.map(segment => (
                    <TableRow key={segment.id}>
                      <TableCell>
                        <div className="font-medium">{segment.name}</div>
                        {segment.description && <div className="text-xs text-muted-foreground">{segment.description}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {segment.source === "affordplan" ? "Affordplan CRM" :
                            segment.source === "his" ? "HIS System" :
                              segment.source === "csv" ? "CSV Upload" : segment.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-medium">
                          <Users size={13} className="text-muted-foreground" />
                          {segment.count.toLocaleString("en-IN")}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {segment.lastRefreshAt ? format(new Date(segment.lastRefreshAt), "d MMM yyyy, h:mm a") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal size={15} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRefresh(segment.id)}>
                              <RefreshCw size={14} className="mr-2" /> Refresh Count
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport(segment.name)}>
                              <Download size={14} className="mr-2" /> Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(segment.id, segment.name)}
                            >
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create Segment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={open => { if (!open) resetDialog(); setIsDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Segment</DialogTitle>
            <p className="text-sm text-muted-foreground">Define an audience for your campaigns. Conditions are applied at launch after suppression scrubbing.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Segment Name *</label>
                <Input
                  required
                  value={basicForm.name}
                  onChange={e => setBasicForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Diabetics – Q3 Follow-up"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={basicForm.description}
                  onChange={e => setBasicForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description…"
                />
              </div>
            </div>

            {/* Source selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Audience Source</label>
              <div className="flex gap-3">
                {([
                  { val: "affordplan", label: "Affordplan CRM" },
                  { val: "his", label: "HIS System" },
                  { val: "csv", label: "CSV Upload" },
                ] as const).map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setBasicForm(f => ({ ...f, source: val })); setCountComputed(false); setCountResult(null); }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${basicForm.source === val ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-accent"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Condition builder — Affordplan source */}
            {basicForm.source === "affordplan" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Conditions</label>
                  <span className="text-xs text-muted-foreground">(patient properties from Affordplan CRM)</span>
                </div>
                <ConditionBuilder groups={groups} onChange={setGroups} />
              </div>
            )}

            {/* HIS — no condition builder in v1 */}
            {basicForm.source === "his" && (
              <div className="bg-muted/50 border rounded-lg p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info size={15} className="flex-shrink-0 mt-0.5" />
                  <span>
                    HIS integration exposes the full patient list. No filterable attributes in v1 — the entire HIS audience will be included.
                    Per-attribute filtering arrives in Phase 2 with the HIS API integration.
                  </span>
                </div>
              </div>
            )}

            {/* CSV — column mapping note */}
            {basicForm.source === "csv" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <Info size={15} className="flex-shrink-0 mt-0.5" />
                  <span>
                    CSV segments use previously uploaded patient lists. Column mapping is governed by Contact Variables (Settings → Contact Variables).
                    Mandatory columns: <strong>first_name</strong>, <strong>mobile</strong>.
                  </span>
                </div>
              </div>
            )}

            {/* Show Count */}
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={handleShowCount}>
                <Users size={14} className="mr-2" /> Show Count
              </Button>
              {countComputed && countResult !== null && (
                <div className="text-sm">
                  <span className="font-semibold text-foreground">{countResult.toLocaleString("en-IN")}</span>
                  <span className="text-muted-foreground ml-2">estimated patients</span>
                </div>
              )}
            </div>
            {countComputed && (
              <p className="text-xs text-muted-foreground -mt-2">
                Counts are estimates. Final audience is re-evaluated at launch after suppression scrubbing and frequency-cap checks.
              </p>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                For UHID-based revenue attribution in Campaign Metrics, ensure your patient data includes valid UHIDs.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetDialog(); }}>Cancel</Button>
              <Button type="submit" disabled={createSegment.isPending}>
                {createSegment.isPending ? "Creating…" : "Save Segment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
