import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetAppointmentsDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { useLocation } from "wouter";
import { CalendarCheck, TrendingUp, TrendingDown, Users, Filter, X } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-100 text-blue-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_BAR_COLOR: Record<string, string> = {
  booked: "#bfdbfe",
  confirmed: "#c7d2fe",
  completed: "#bbf7d0",
  cancelled: "#fecaca",
};

export default function AppointmentsDashboard() {
  const [, navigate] = useLocation();
  const { data: dashboard, isLoading } = useGetAppointmentsDashboard();
  const [filterSpec, setFilterSpec] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const d = dashboard as any;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">Loading…</div>
      </AppLayout>
    );
  }
  if (!d) return null;

  const byStatus: any[] = d.byStatus ?? [];
  const bySpecialization: any[] = d.bySpecialization ?? [];
  const trend: any[] = d.trend ?? [];
  const byDoctor: any[] = d.byDoctor ?? [];
  const byChannel: any[] = d.byChannel ?? [];

  const allSpecs = [...new Set(byDoctor.map((d: any) => d.specialization).filter(Boolean))] as string[];
  const allDoctors = byDoctor.filter((d: any) => !filterSpec || d.specialization === filterSpec);
  const allSources = [...new Set(byChannel.map((c: any) => c.channel).filter(Boolean))] as string[];

  const filteredByDoctor = byDoctor.filter((doc: any) => {
    if (filterSpec && doc.specialization !== filterSpec) return false;
    if (filterDoctor && doc.name !== filterDoctor) return false;
    return true;
  });


  const total: number = d.total ?? 0;
  const completionRate: number = d.completionRate ?? 0;
  const cancellationRate: number = d.cancellationRate ?? 0;
  const todayCount: number = byStatus.reduce((s: number, x: any) => s + (x.status === "booked" || x.status === "confirmed" ? x.count : 0), 0);

  const maxStatusCount = Math.max(...byStatus.map((s: any) => s.count), 1);

  const SOURCE_LABELS: Record<string, string> = {
    web: "Website", app: "Mobile App", app_booking: "App Booking", in_person: "In-person", web_booking: "Web Booking",
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Appointments Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Booking trends, doctor utilisation, and source attribution.</p>
        </div>

        {/* ── BOOKING SUMMARY ──────────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Booking Summary
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => navigate("/appointments/bookings")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Total Appointments</p>
                <p className="text-3xl font-bold" data-testid="stat-total-appointments">
                  {total.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-blue-200 transition-colors"
              onClick={() => navigate("/appointments/bookings?status=booked")}
            >
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">Pending Confirmation</p>
                <p className="text-3xl font-bold text-blue-600" data-testid="stat-pending">
                  {todayCount.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-blue-600 mt-1 hover:underline">Click to review →</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-green-200 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-muted-foreground mb-2">Completion Rate</p>
                  <TrendingUp className="w-4 h-4 text-green-500 mt-0.5" />
                </div>
                <p className="text-3xl font-bold text-green-600" data-testid="stat-completion-rate">
                  {completionRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Of all booked appointments</p>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-red-200 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-muted-foreground mb-2">Cancellation Rate</p>
                  <TrendingDown className="w-4 h-4 text-red-400 mt-0.5" />
                </div>
                <p className="text-3xl font-bold text-red-500" data-testid="stat-cancellation-rate">
                  {cancellationRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Cancelled or no-show</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── STATUS & SPECIALIZATION ─────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Breakdown
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* By Status — horizontal bar rows */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base font-semibold">By Status</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Distribution across appointment lifecycle</p>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-2.5 mt-1">
                  {byStatus.map((s: any) => (
                    <div
                      key={s.status}
                      className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 py-0.5 group"
                      onClick={() => navigate(`/appointments/bookings?status=${s.status}`)}
                    >
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize w-24 text-center shrink-0 ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {s.status}
                      </span>
                      <div className="flex-1 h-[10px] bg-muted/40 rounded-sm overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all"
                          style={{
                            width: `${(s.count / maxStatusCount) * 100}%`,
                            backgroundColor: STATUS_BAR_COLOR[s.status] ?? "#e5e7eb",
                            border: `1px solid ${STATUS_BAR_COLOR[s.status] ?? "#e5e7eb"}`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-xs font-semibold text-right shrink-0">{s.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* By Specialisation */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base font-semibold">By Specialisation</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Appointments per department</p>
              </CardHeader>
              <CardContent className="px-3 pb-5">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySpecialization.slice(0, 6)} layout="vertical" barCategoryGap="30%"
                      margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="specialization" width={96} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" name="Appointments" fill="hsl(var(--primary) / 0.7)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── BOOKING TREND ───────────────────────── */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Trend
          </p>
          <Card>
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-base font-semibold">Booking Trend — Last 7 Days</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Daily bookings vs completions</p>
            </CardHeader>
            <CardContent className="px-3 pb-5">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Line type="monotone" dataKey="count" name="Booked" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── DOCTOR UTILISATION ───────────────────── */}
        {byDoctor.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                Doctor Utilisation
              </p>
              {/* Filters */}
              <div className="flex items-center gap-2">
                {allSources.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Filter className="w-3 h-3 text-muted-foreground" />
                    <select
                      value={filterSource}
                      onChange={e => setFilterSource(e.target.value)}
                      className="text-xs border rounded px-2 py-1 bg-background h-7"
                    >
                      <option value="">All Channels</option>
                      {allSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <select
                  value={filterSpec}
                  onChange={e => { setFilterSpec(e.target.value); setFilterDoctor(""); }}
                  className="text-xs border rounded px-2 py-1 bg-background h-7"
                >
                  <option value="">All Specialisations</option>
                  {allSpecs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={filterDoctor}
                  onChange={e => setFilterDoctor(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-background h-7"
                >
                  <option value="">All Doctors</option>
                  {allDoctors.map((d: any) => <option key={d.doctorId} value={d.name}>{d.name}</option>)}
                </select>
                {(filterSpec || filterDoctor || filterSource) && (
                  <button
                    onClick={() => { setFilterSpec(""); setFilterDoctor(""); setFilterSource(""); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-4 font-medium">Doctor</th>
                      <th className="text-left p-4 font-medium">Specialisation</th>
                      <th className="text-right p-4 font-medium">Total</th>
                      <th className="text-right p-4 font-medium">Completed</th>
                      <th className="text-right p-4 pr-6 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredByDoctor.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-8">No doctors match filters</td></tr>
                    ) : filteredByDoctor.map((doc: any) => {
                      const rate = doc.count > 0 ? Math.round((doc.completed / doc.count) * 100) : 0;
                      return (
                        <tr key={doc.doctorId} className="border-b last:border-0 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => navigate("/appointments/doctors")}>
                          <td className="p-4 font-medium">{doc.name}</td>
                          <td className="p-4 text-muted-foreground text-xs">{doc.specialization}</td>
                          <td className="p-4 text-right">{doc.count}</td>
                          <td className="p-4 text-right text-green-600 font-medium">{doc.completed}</td>
                          <td className="p-4 pr-6 text-right">
                            <span className={`text-[11px] font-semibold ${rate >= 50 ? "text-green-600" : rate > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {rate > 0 ? `${rate}%` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
