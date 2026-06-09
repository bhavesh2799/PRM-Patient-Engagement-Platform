import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListDoctors,
  useUpdateDoctor,
  useCreateDoctor,
  getListDoctorsQueryKey,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Edit, Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor } from "@workspace/api-client-react";

type DoctorSlot = { day: string; startTime: string; endTime: string };

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

function avatarColor(name: string) {
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-pink-100 text-pink-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getTodayAvailability(slots: DoctorSlot[]): { available: boolean; time?: string } {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const slot = slots.find((s) => s.day === today);
  if (!slot) return { available: false };
  return { available: true, time: `${slot.startTime} – ${slot.endTime}` };
}

interface ScheduleFormState {
  [day: string]: { enabled: boolean; startTime: string; endTime: string };
}

function buildScheduleFormState(slots: DoctorSlot[]): ScheduleFormState {
  const state: ScheduleFormState = {};
  for (const day of DAYS_OF_WEEK) {
    const slot = slots.find((s) => s.day === day);
    state[day] = slot
      ? { enabled: true, startTime: slot.startTime, endTime: slot.endTime }
      : { enabled: false, startTime: "09:00", endTime: "17:00" };
  }
  return state;
}

function scheduleStateToSlots(state: ScheduleFormState): DoctorSlot[] {
  return DAYS_OF_WEEK.filter((d) => state[d].enabled).map((d) => ({
    day: d,
    startTime: state[d].startTime,
    endTime: state[d].endTime,
  }));
}

const EMPTY_FORM = {
  name: "",
  specialization: "",
  qualifications: "",
  experience: "",
  email: "",
  mobile: "",
  bio: "",
  registrationNumber: "",
  active: "true" as "true" | "false",
};

const SPECIALIZATIONS = [
  "Cardiology", "Orthopedics", "Neurology", "Oncology", "Gynaecology",
  "Paediatrics", "Dermatology", "General Medicine", "Gastroenterology", "Urology",
];

export default function Doctors() {
  const queryClient = useQueryClient();
  const { data: doctors = [], isLoading } = useListDoctors();
  const updateDoctor = useUpdateDoctor();
  const createDoctor = useCreateDoctor();

  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [drawerTab, setDrawerTab] = useState("profile");

  const [form, setForm] = useState(EMPTY_FORM);
  const [scheduleState, setScheduleState] = useState<ScheduleFormState>(
    buildScheduleFormState([])
  );
  const [saving, setSaving] = useState(false);

  const uniqueSpecs = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.specialization))).sort(),
    [doctors]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return doctors.filter((d) => {
      if (q && !`${d.name} ${d.specialization} ${d.qualifications ?? ""}`.toLowerCase().includes(q)) return false;
      if (specFilter !== "all" && d.specialization !== specFilter) return false;
      if (activeFilter === "active" && !d.active) return false;
      if (activeFilter === "inactive" && d.active) return false;
      return true;
    });
  }, [doctors, search, specFilter, activeFilter]);

  function openEdit(doctor: Doctor) {
    setEditDoctor(doctor);
    setShowAdd(false);
    setDrawerTab("profile");
    setForm({
      name: doctor.name,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications ?? "",
      experience: doctor.experience != null ? String(doctor.experience) : "",
      email: doctor.email ?? "",
      mobile: doctor.mobile ?? "",
      bio: doctor.bio ?? "",
      registrationNumber: doctor.registrationNumber ?? "",
      active: doctor.active ? "true" : "false",
    });
    setScheduleState(buildScheduleFormState((doctor.slots as DoctorSlot[]) ?? []));
  }

  function openAdd() {
    setEditDoctor(null);
    setShowAdd(true);
    setDrawerTab("profile");
    setForm(EMPTY_FORM);
    setScheduleState(buildScheduleFormState([]));
  }

  function closeDrawer() {
    setEditDoctor(null);
    setShowAdd(false);
  }

  function handleSave() {
    if (!form.name || !form.specialization) return;
    setSaving(true);
    const slots = scheduleStateToSlots(scheduleState);
    const payload = {
      name: form.name,
      specialization: form.specialization,
      qualifications: form.qualifications || undefined,
      experience: form.experience ? parseInt(form.experience, 10) : undefined,
      email: form.email || undefined,
      mobile: form.mobile || undefined,
      bio: form.bio || undefined,
      registrationNumber: form.registrationNumber || undefined,
      active: form.active === "true",
      slots,
    };

    if (editDoctor) {
      updateDoctor.mutate(
        { id: editDoctor.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListDoctorsQueryKey() });
            closeDrawer();
            setSaving(false);
          },
          onError: () => setSaving(false),
        }
      );
    } else {
      createDoctor.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListDoctorsQueryKey() });
            closeDrawer();
            setSaving(false);
          },
          onError: () => setSaving(false),
        }
      );
    }
  }

  const isDrawerOpen = !!editDoctor || showAdd;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Doctors & Availability</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage doctor profiles and weekly schedules.</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Doctor
          </Button>
        </div>

        {/* Filter bar */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px] relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, speciality…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm pl-8"
              />
            </div>
            <div className="w-44">
              <Select value={specFilter} onValueChange={setSpecFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All specialities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All specialities</SelectItem>
                  {uniqueSpecs.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Doctor cards */}
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading doctors…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No doctors match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((doctor) => {
              const slots = (doctor.slots as DoctorSlot[]) ?? [];
              const avail = getTodayAvailability(slots);
              const availDays = slots.map((s) => SHORT_DAYS[s.day] ?? s.day.slice(0, 3));
              return (
                <div key={doctor.id} className="bg-card rounded-xl border overflow-hidden flex flex-col">
                  <div className="p-4 flex gap-3 items-start">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0", avatarColor(doctor.name))}>
                      {initials(doctor.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-foreground leading-tight text-sm">{doctor.name}</div>
                          <div className="text-xs text-primary font-medium mt-0.5">{doctor.specialization}</div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border",
                            doctor.active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          )}
                        >
                          {doctor.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {doctor.qualifications && (
                        <div className="text-xs text-muted-foreground mt-1 leading-tight">{doctor.qualifications}</div>
                      )}
                    </div>
                  </div>

                  <div className="px-4 pb-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/40 rounded-lg px-3 py-2">
                      <div className="text-muted-foreground mb-0.5">Experience</div>
                      <div className="font-semibold text-foreground">
                        {doctor.experience != null ? `${doctor.experience} yrs` : "—"}
                      </div>
                    </div>
                    <div className="bg-muted/40 rounded-lg px-3 py-2">
                      <div className="text-muted-foreground mb-0.5">Working Days</div>
                      <div className="font-semibold text-foreground">{slots.length > 0 ? `${slots.length} days/wk` : "Not set"}</div>
                    </div>
                  </div>

                  {/* Availability pills */}
                  <div className="px-4 pb-3">
                    {availDays.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {DAYS_OF_WEEK.map((day) => {
                          const has = slots.some((s) => s.day === day);
                          return (
                            <span
                              key={day}
                              className={cn(
                                "text-xs px-2 py-0.5 rounded border",
                                has
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {SHORT_DAYS[day]}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No schedule set</span>
                    )}
                  </div>

                  {/* Today availability */}
                  <div className="px-4 pb-3 flex items-center gap-1.5 text-xs">
                    {avail.available ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-700">Available today · {avail.time}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Not available today</span>
                      </>
                    )}
                  </div>

                  <div className="mt-auto px-4 pb-4 pt-1 border-t flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => openEdit(doctor)}>
                      <Edit className="w-3 h-3 mr-1" /> Edit Profile
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => { openEdit(doctor); setDrawerTab("schedule"); setTimeout(() => setDrawerTab("schedule"), 50); }}
                    >
                      <Clock className="w-3 h-3 mr-1" /> Schedule
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Add Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col p-0 overflow-hidden">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base">
              {editDoctor ? `Edit: ${editDoctor.name}` : "Add Doctor"}
            </SheetTitle>
          </SheetHeader>

          <Tabs value={drawerTab} onValueChange={setDrawerTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-5 mt-3 h-9 w-fit">
              <TabsTrigger value="profile" className="text-xs px-4">Profile</TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs px-4">Schedule</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="flex-1 overflow-y-auto px-5 pb-4 mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Full Name <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="Dr. Name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Speciality <span className="text-red-500">*</span></label>
                  <Select value={form.specialization} onValueChange={(v) => setForm((f) => ({ ...f, specialization: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALIZATIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Experience (years)</label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={form.experience}
                    onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Qualifications / Designation</label>
                  <Input
                    placeholder="MBBS, MD, DM (Cardiology)"
                    value={form.qualifications}
                    onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Mobile</label>
                  <Input
                    placeholder="9876543210"
                    value={form.mobile}
                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Email</label>
                  <Input
                    type="email"
                    placeholder="doctor@hospital.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Registration No.</label>
                  <Input
                    placeholder="MCI/12345/2014"
                    value={form.registrationNumber}
                    onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Profile Status</label>
                  <Select value={form.active} onValueChange={(v: "true" | "false") => setForm((f) => ({ ...f, active: v }))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Short Bio</label>
                  <Textarea
                    placeholder="Senior consultant with focus on…"
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="flex-1 overflow-y-auto px-5 pb-4 mt-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Weekly Availability</div>
                <p className="text-xs text-muted-foreground mb-4">
                  Toggle the days the doctor is available and set consultation hours.
                </p>
                {DAYS_OF_WEEK.map((day) => {
                  const dayState = scheduleState[day];
                  return (
                    <div key={day} className={cn("rounded-lg border p-3 transition-colors", dayState.enabled ? "bg-emerald-50/40 border-emerald-200" : "bg-muted/20 border-border/50")}>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                          <div
                            className={cn(
                              "w-9 h-5 rounded-full relative transition-colors cursor-pointer",
                              dayState.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                            )}
                            onClick={() =>
                              setScheduleState((s) => ({
                                ...s,
                                [day]: { ...s[day], enabled: !s[day].enabled },
                              }))
                            }
                          >
                            <div
                              className={cn(
                                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                                dayState.enabled ? "left-4" : "left-0.5"
                              )}
                            />
                          </div>
                          <span className={cn("text-sm font-medium w-20", dayState.enabled ? "text-foreground" : "text-muted-foreground")}>
                            {day}
                          </span>
                        </label>
                        {dayState.enabled && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={dayState.startTime}
                              onChange={(e) =>
                                setScheduleState((s) => ({
                                  ...s,
                                  [day]: { ...s[day], startTime: e.target.value },
                                }))
                              }
                              className="h-8 text-xs w-28"
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={dayState.endTime}
                              onChange={(e) =>
                                setScheduleState((s) => ({
                                  ...s,
                                  [day]: { ...s[day], endTime: e.target.value },
                                }))
                              }
                              className="h-8 text-xs w-28"
                            />
                          </div>
                        )}
                        {!dayState.enabled && (
                          <span className="text-xs text-muted-foreground">Off</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="px-5 py-4 border-t flex gap-2">
            <Button variant="outline" className="flex-1" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !form.name || !form.specialization}
            >
              {saving ? "Saving…" : editDoctor ? "Save Changes" : "Add Doctor"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
