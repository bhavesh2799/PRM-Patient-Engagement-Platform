import { useState, useMemo, useEffect } from "react";
import { format, parseISO, isToday } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListAppointments,
  useListDoctors,
  useUpdateAppointment,
  useCreateAppointment,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Eye, Check, X, Plus, RotateCcw, CalendarDays, Clock, User, Stethoscope, Hash, Smartphone, Globe, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment } from "@workspace/api-client-react";

const STATUS_LABELS: Record<string, string> = {
  booked: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CLASSES: Record<string, string> = {
  booked: "bg-amber-50 text-amber-700 border border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  completed: "bg-sky-50 text-sky-700 border border-sky-200",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200",
};

const SOURCE_LABELS: Record<string, string> = {
  app_booking: "App",
  web_booking: "Web",
  walk_in: "Walk-in",
  form: "Form",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600 border border-gray-200"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function SourceBadge({ channel }: { channel: string }) {
  const icons: Record<string, React.ReactNode> = {
    app_booking: <Smartphone className="w-3 h-3" />,
    web_booking: <Globe className="w-3 h-3" />,
    walk_in: <Footprints className="w-3 h-3" />,
    form: <Globe className="w-3 h-3" />,
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {icons[channel] ?? null}
      {SOURCE_LABELS[channel] ?? channel}
    </span>
  );
}

function apptId(id: number) {
  return `APT-${String(id).padStart(5, "0")}`;
}

interface StatCardProps {
  label: string;
  value: number;
  accent: string;
  sub?: string;
}

function StatCard({ label, value, accent, sub }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl border overflow-hidden flex">
      <div className={cn("w-1 shrink-0", accent)} />
      <div className="p-4 flex-1">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm font-medium text-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

const EMPTY_FORM = {
  speciality: "",
  doctorId: "",
  date: "",
  time: "",
  patientName: "",
  patientMobile: "",
  patientUhid: "",
  notes: "",
};

export default function Bookings() {
  const queryClient = useQueryClient();
  const { data: appointments = [], isLoading } = useListAppointments();
  const { data: doctors = [] } = useListDoctors();
  const updateAppt = useUpdateAppointment();
  const createAppt = useCreateAppointment();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [specFilter, setSpecFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [showNewAppt, setShowNewAppt] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedAppt) {
      setUpdateStatus(selectedAppt.status);
      setUpdateNotes(selectedAppt.notes ?? "");
    }
  }, [selectedAppt?.id]);

  const uniqueSpecs = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.specialization))).sort(),
    [doctors]
  );

  const filteredDoctorsForForm = useMemo(
    () =>
      newForm.speciality
        ? doctors.filter((d) => d.specialization === newForm.speciality)
        : doctors,
    [doctors, newForm.speciality]
  );

  const stats = useMemo(() => {
    const todayAppts = appointments.filter((a) => {
      try { return isToday(parseISO(a.datetime)); } catch { return false; }
    });
    return {
      today: todayAppts.length,
      pending: appointments.filter((a) => a.status === "booked").length,
      completedToday: todayAppts.filter((a) => a.status === "completed").length,
      cancelled: appointments.filter((a) => a.status === "cancelled").length,
    };
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return appointments.filter((a) => {
      if (
        q &&
        !`${a.leadName ?? ""} ${a.leadMobile ?? ""} ${a.leadUhid ?? ""} ${apptId(a.id)}`.toLowerCase().includes(q)
      )
        return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (doctorFilter !== "all" && String(a.doctorId) !== doctorFilter) return false;
      if (specFilter !== "all" && a.specialization !== specFilter) return false;
      if (dateFilter) {
        try {
          const d = format(parseISO(a.datetime), "yyyy-MM-dd");
          if (d !== dateFilter) return false;
        } catch {
          return false;
        }
      }
      return true;
    });
  }, [appointments, search, statusFilter, doctorFilter, specFilter, dateFilter]);

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setDoctorFilter("all");
    setSpecFilter("all");
    setDateFilter("");
  }

  function handleSaveUpdate() {
    if (!selectedAppt) return;
    setSaving(true);
    updateAppt.mutate(
      { id: selectedAppt.id, data: { status: updateStatus as Appointment["status"], notes: updateNotes } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          setSelectedAppt(null);
          setSaving(false);
        },
        onError: () => setSaving(false),
      }
    );
  }

  function handleQuickAction(appt: Appointment, action: "confirm" | "cancel") {
    const newStatus = action === "confirm" ? "confirmed" : "cancelled";
    updateAppt.mutate(
      { id: appt.id, data: { status: newStatus } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }) }
    );
  }

  function handleCreateAppt() {
    if (!newForm.doctorId || !newForm.date || !newForm.time || !newForm.patientName || !newForm.patientMobile) return;
    const doctor = doctors.find((d) => String(d.id) === newForm.doctorId);
    if (!doctor) return;
    setSubmitting(true);
    const datetime = new Date(`${newForm.date}T${newForm.time}:00`).toISOString();
    createAppt.mutate(
      {
        data: {
          patientName: newForm.patientName,
          patientMobile: newForm.patientMobile,
          patientUhid: newForm.patientUhid || undefined,
          doctorId: Number(newForm.doctorId),
          specialization: doctor.specialization,
          sourceChannel: "walk_in",
          datetime,
          notes: newForm.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
          setShowNewAppt(false);
          setNewForm(EMPTY_FORM);
          setSubmitting(false);
        },
        onError: () => setSubmitting(false),
      }
    );
  }

  function fmtDate(iso: string) {
    try { return format(parseISO(iso), "dd MMM yyyy"); } catch { return "—"; }
  }
  function fmtTime(iso: string) {
    try { return format(parseISO(iso), "hh:mm aa"); } catch { return "—"; }
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Appointment Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track, confirm, and manage patient bookings.</p>
          </div>
          <Button onClick={() => setShowNewAppt(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Book Appointment
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Appointments" value={stats.today} accent="bg-primary" sub="Scheduled for today" />
          <StatCard label="Pending Confirmation" value={stats.pending} accent="bg-amber-400" sub="Awaiting confirmation" />
          <StatCard label="Completed Today" value={stats.completedToday} accent="bg-emerald-400" sub="Done today" />
          <StatCard label="Cancelled" value={stats.cancelled} accent="bg-slate-400" sub="All time" />
        </div>

        {/* Filter bar */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <div className="text-xs text-muted-foreground mb-1.5 font-medium">Search</div>
              <Input
                placeholder="Patient, mobile, UHID, Appt ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-36">
              <div className="text-xs text-muted-foreground mb-1.5 font-medium">Status</div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="booked">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <div className="text-xs text-muted-foreground mb-1.5 font-medium">Doctor</div>
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All doctors</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <div className="text-xs text-muted-foreground mb-1.5 font-medium">Speciality</div>
              <Select value={specFilter} onValueChange={setSpecFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueSpecs.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <div className="text-xs text-muted-foreground mb-1.5 font-medium">Date</div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {isLoading ? "Loading…" : `Showing ${filtered.length} of ${appointments.length} appointments`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Appt ID</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">UHID</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Patient</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Doctor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Date & Time</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Token</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                      Loading appointments…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                      No appointments match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((apt) => (
                    <tr key={apt.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">{apptId(apt.id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {apt.leadUhid ? (
                          <span className="font-mono text-xs text-foreground">{apt.leadUhid}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground leading-tight">{apt.leadName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{apt.leadMobile ?? ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground leading-tight">{apt.doctorName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{apt.specialization}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-foreground">{fmtDate(apt.datetime)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{fmtTime(apt.datetime)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge channel={apt.sourceChannel} />
                      </td>
                      <td className="px-4 py-3">
                        {apt.token ? (
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{apt.token}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={apt.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="View details"
                            onClick={() => setSelectedAppt(apt)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {apt.status === "booked" && (
                            <button
                              title="Confirm"
                              onClick={() => handleQuickAction(apt, "confirm")}
                              className="p-1.5 rounded-md hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {apt.status !== "cancelled" && apt.status !== "completed" && (
                            <button
                              title="Cancel"
                              onClick={() => handleQuickAction(apt, "cancel")}
                              className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Appointment Detail Drawer */}
      <Sheet open={!!selectedAppt} onOpenChange={(open) => !open && setSelectedAppt(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px] flex flex-col p-0 overflow-hidden">
          {selectedAppt && (
            <>
              <SheetHeader className="px-5 pt-5 pb-4 border-b">
                <SheetTitle className="text-base">{selectedAppt.leadName ?? "Appointment"}</SheetTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={selectedAppt.status} />
                  <span className="font-mono text-xs text-muted-foreground">{apptId(selectedAppt.id)}</span>
                  {selectedAppt.token && (
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{selectedAppt.token}</span>
                  )}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Patient */}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Patient
                  </div>
                  <InfoRow label="UHID" value={<span className="font-mono">{selectedAppt.leadUhid ?? "—"}</span>} />
                  <InfoRow label="Name" value={selectedAppt.leadName ?? "—"} />
                  <InfoRow label="Mobile" value={selectedAppt.leadMobile ?? "—"} />
                  <InfoRow label="Source" value={SOURCE_LABELS[selectedAppt.sourceChannel] ?? selectedAppt.sourceChannel} />
                </div>

                <Separator />

                {/* Appointment */}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" /> Appointment
                  </div>
                  <InfoRow label="Doctor" value={selectedAppt.doctorName ?? "—"} />
                  <InfoRow label="Speciality" value={selectedAppt.specialization} />
                  <InfoRow
                    label="Date & Time"
                    value={`${fmtDate(selectedAppt.datetime)} at ${fmtTime(selectedAppt.datetime)}`}
                  />
                  <InfoRow
                    label="Token ID"
                    value={
                      selectedAppt.token ? (
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{selectedAppt.token}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Generated on confirmation</span>
                      )
                    }
                  />
                  <InfoRow
                    label="Remarks"
                    value={selectedAppt.notes ? selectedAppt.notes : <span className="text-muted-foreground text-xs">No remarks</span>}
                  />
                </div>

                <Separator />

                {/* Update Status */}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> Update Status
                  </div>
                  {updateStatus === "booked" && (
                    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2.5 mb-3">
                      ⚡ Confirming will generate a Token ID and send it to the patient via SMS.
                    </div>
                  )}
                  <div className="space-y-3">
                    <Select value={updateStatus} onValueChange={setUpdateStatus}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booked">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Add internal remarks…"
                      value={updateNotes}
                      onChange={(e) => setUpdateNotes(e.target.value)}
                      rows={3}
                      className="text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              <SheetFooter className="px-5 py-4 border-t flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedAppt(null)}>
                  Close
                </Button>
                <Button className="flex-1" onClick={handleSaveUpdate} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Book Appointment Drawer */}
      <Sheet open={showNewAppt} onOpenChange={(open) => { if (!open) { setShowNewAppt(false); setNewForm(EMPTY_FORM); } }}>
        <SheetContent className="w-[440px] sm:max-w-[440px] flex flex-col p-0 overflow-hidden">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">Book Appointment Manually</SheetTitle>
            <p className="text-xs text-muted-foreground">For walk-in or phone bookings</p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Doctor & Slot */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" /> Doctor & Slot
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Speciality <span className="text-red-500">*</span></label>
                  <Select
                    value={newForm.speciality}
                    onValueChange={(v) => setNewForm((f) => ({ ...f, speciality: v, doctorId: "" }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueSpecs.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Doctor <span className="text-red-500">*</span></label>
                  <Select
                    value={newForm.doctorId}
                    onValueChange={(v) => setNewForm((f) => ({ ...f, doctorId: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDoctorsForForm.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Date <span className="text-red-500">*</span></label>
                  <Input
                    type="date"
                    value={newForm.date}
                    onChange={(e) => setNewForm((f) => ({ ...f, date: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Time <span className="text-red-500">*</span></label>
                  <Input
                    type="time"
                    value={newForm.time}
                    onChange={(e) => setNewForm((f) => ({ ...f, time: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Patient Details */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Patient Details
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">Patient Name <span className="text-red-500">*</span></label>
                    <Input
                      placeholder="Full name"
                      value={newForm.patientName}
                      onChange={(e) => setNewForm((f) => ({ ...f, patientName: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">Mobile <span className="text-red-500">*</span></label>
                    <Input
                      placeholder="10-digit number"
                      value={newForm.patientMobile}
                      onChange={(e) => setNewForm((f) => ({ ...f, patientMobile: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">UHID</label>
                  <Input
                    placeholder="e.g. BIL-2026-001234"
                    value={newForm.patientUhid}
                    onChange={(e) => setNewForm((f) => ({ ...f, patientUhid: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Remarks</label>
                  <Textarea
                    placeholder="Any specific note from the patient…"
                    value={newForm.notes}
                    onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="px-5 py-4 border-t flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowNewAppt(false); setNewForm(EMPTY_FORM); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateAppt}
              disabled={
                submitting ||
                !newForm.doctorId ||
                !newForm.date ||
                !newForm.time ||
                !newForm.patientName ||
                !newForm.patientMobile
              }
            >
              {submitting ? "Booking…" : "Confirm Booking"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
