import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetAppointmentsDashboard } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  T, DashPage, PageHead, DCard, CardTitle, SectionLabel, MetricCard,
  Badge, BadgeTone, BarRow,
} from "@/components/dashboard/ui";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";

const STATUS_TONE: Record<string, BadgeTone> = {
  booked: "info", confirmed: "info", completed: "ok", cancelled: "danger",
};

const STATUS_COLOR: Record<string, string> = {
  booked: T.blue, confirmed: "#6366F1", completed: T.green, cancelled: T.red,
};

export default function AppointmentsDashboard() {
  const [, navigate] = useLocation();
  const { data: dashboard, isLoading } = useGetAppointmentsDashboard();
  const [filterSpec, setFilterSpec] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  if (isLoading) return (
    <AppLayout>
      <DashPage>
        <div className="flex items-center justify-center h-96 text-sm" style={{ color: T.ink3 }}>Loading…</div>
      </DashPage>
    </AppLayout>
  );

  const d = dashboard as any;
  if (!d) return null;

  const byStatus: any[] = d.byStatus ?? [];
  const bySpecialization: any[] = d.bySpecialization ?? [];
  const trend: any[] = d.trend ?? [];
  const byDoctor: any[] = d.byDoctor ?? [];

  const total: number = d.total ?? 0;
  const completionRate: number = d.completionRate ?? 0;
  const cancellationRate: number = d.cancellationRate ?? 0;
  const pending = byStatus.filter((s: any) => s.status === "booked" || s.status === "confirmed").reduce((sum: number, s: any) => sum + s.count, 0);
  const completed = byStatus.find((s: any) => s.status === "completed")?.count ?? 0;
  const maxStatusCount = Math.max(...byStatus.map((s: any) => s.count), 1);

  const allSpecs = [...new Set(byDoctor.map((d: any) => d.specialization).filter(Boolean))] as string[];
  const filteredDoctors = byDoctor.filter((doc: any) => {
    if (filterSpec && doc.specialization !== filterSpec) return false;
    if (filterDoctor && doc.name !== filterDoctor) return false;
    return true;
  });
  const allDoctorNames = byDoctor.filter((d: any) => !filterSpec || d.specialization === filterSpec);

  const filteredByStatus = filterStatus ? byStatus.filter((s: any) => s.status === filterStatus) : byStatus;

  const selectStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: T.ink1, background: T.surface2,
    border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 9px", cursor: "pointer",
  };

  return (
    <AppLayout>
      <DashPage>
        <PageHead
          title="Appointments Dashboard"
          subtitle="Booking volume, utilisation, completion rates & doctor performance"
          right={<span className="text-xs" style={{ color: T.ink3 }}>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
        />

        {/* KPI row */}
        <SectionLabel>Booking summary</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard
            accent={T.blue}
            label="Total appointments"
            value={total.toLocaleString("en-IN")}
            sub="All time"
            onClick={() => navigate("/appointments/bookings")}
          />
          <MetricCard
            accent={T.amber}
            label="Pending confirmation"
            value={pending.toLocaleString("en-IN")}
            valueColor={T.amber}
            sub="Booked + confirmed"
            onClick={() => navigate("/appointments/bookings?status=booked")}
          />
          <MetricCard
            accent={T.green}
            label="Completion rate"
            value={`${completionRate}%`}
            valueColor={T.green}
            sub="Of all booked appointments"
            progress={{ pct: completionRate, color: T.green }}
          />
          <MetricCard
            accent={T.red}
            label="Cancellation rate"
            value={`${cancellationRate}%`}
            valueColor={cancellationRate > 20 ? T.red : T.amber}
            sub="Cancelled or no-show"
            progress={{ pct: cancellationRate, color: T.red }}
          />
        </div>

        {/* Status breakdown + Specialisation */}
        <SectionLabel>Breakdown</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DCard>
            <div className="flex items-center justify-between mb-3">
              <CardTitle>By status</CardTitle>
              <select style={selectStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="booked">Booked</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {filteredByStatus.map((s: any) => (
              <button
                key={s.status}
                onClick={() => navigate(`/appointments/bookings?status=${s.status}`)}
                className="w-full flex items-center gap-3 mb-2.5 group"
              >
                <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                <div className="flex-1 h-[10px] rounded-sm overflow-hidden" style={{ background: T.surface2 }}>
                  <div
                    className="h-[10px] rounded-sm"
                    style={{ width: `${(s.count / maxStatusCount) * 100}%`, background: STATUS_COLOR[s.status] ?? T.blue, opacity: 0.75 }}
                  />
                </div>
                <span className="text-[12px] font-semibold shrink-0" style={{ color: T.ink1, width: 28, textAlign: "right" }}>{s.count}</span>
              </button>
            ))}
            <div className="h-px my-3" style={{ background: T.border2 }} />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-3 py-2.5" style={{ background: T.greenBg }}>
                <div className="text-[10px] font-bold uppercase tracking-[0.05em] mb-0.5" style={{ color: T.green }}>Completed</div>
                <div className="text-[20px] font-bold" style={{ color: T.green }}>{completed}</div>
              </div>
              <div className="rounded-lg px-3 py-2.5" style={{ background: T.amberBg }}>
                <div className="text-[10px] font-bold uppercase tracking-[0.05em] mb-0.5" style={{ color: T.amber }}>Pending</div>
                <div className="text-[20px] font-bold" style={{ color: T.amber }}>{pending}</div>
              </div>
            </div>
          </DCard>

          <DCard>
            <CardTitle hint="Appointments per department">By specialisation</CardTitle>
            {bySpecialization.length === 0 ? (
              <div className="text-[12px] py-4" style={{ color: T.ink3 }}>No specialisation data available.</div>
            ) : (
              <>
                {bySpecialization.slice(0, 6).map((s: any) => {
                  const specMax = Math.max(...bySpecialization.slice(0, 6).map((x: any) => x.count), 1);
                  return (
                    <BarRow
                      key={s.specialization}
                      label={s.specialization ?? "Other"}
                      pct={(s.count / specMax) * 100}
                      color={T.blue}
                      value={s.count}
                      labelWidth={100}
                    />
                  );
                })}
              </>
            )}
          </DCard>
        </div>

        {/* Booking trend chart */}
        <SectionLabel>Trend</SectionLabel>
        <DCard className="mb-4">
          <CardTitle hint="Daily bookings vs completions">Booking trend — last 7 days</CardTitle>
          <div className="h-52 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border2} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: T.ink3 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.ink3 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="count" name="Booked" stroke={T.blue} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke={T.green} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DCard>

        {/* Doctor utilisation */}
        {byDoctor.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2.5 mt-6">
              <span className="text-[10px] font-bold tracking-[0.09em] uppercase" style={{ color: T.ink3 }}>Doctor utilisation</span>
              <div className="flex items-center gap-2">
                <select style={{ ...selectStyle, fontSize: 11 }} value={filterSpec} onChange={e => { setFilterSpec(e.target.value); setFilterDoctor(""); }}>
                  <option value="">All specialisations</option>
                  {allSpecs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select style={{ ...selectStyle, fontSize: 11 }} value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)}>
                  <option value="">All doctors</option>
                  {allDoctorNames.map((d: any) => <option key={d.doctorId} value={d.name}>{d.name}</option>)}
                </select>
                {(filterSpec || filterDoctor) && (
                  <button onClick={() => { setFilterSpec(""); setFilterDoctor(""); }} className="text-[11px] px-2.5 py-[5px] rounded-md" style={{ border: `1px solid ${T.border}`, color: T.ink1, background: T.surface }}>Reset</button>
                )}
              </div>
            </div>
            <DCard>
              <CardTitle hint="Completions per doctor">Doctor performance</CardTitle>
              {filteredDoctors.length === 0 ? (
                <div className="text-[12px] py-4 text-center" style={{ color: T.ink3 }}>No doctors match filters.</div>
              ) : (
                <table className="w-full text-[12px] mt-2">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.06em]" style={{ color: T.ink3 }}>
                      <th className="text-left font-semibold pb-2 pr-3">Doctor</th>
                      <th className="text-left font-semibold pb-2 pr-3">Specialisation</th>
                      <th className="text-right font-semibold pb-2 pr-3">Total</th>
                      <th className="text-right font-semibold pb-2 pr-3">Completed</th>
                      <th className="text-right font-semibold pb-2">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDoctors.map((doc: any) => {
                      const rate = doc.count > 0 ? Math.round((doc.completed / doc.count) * 100) : 0;
                      return (
                        <tr
                          key={doc.doctorId}
                          style={{ borderTop: `1px solid ${T.border2}` }}
                          className="cursor-pointer hover:bg-[#FAFAF8]"
                          onClick={() => navigate("/appointments/doctors")}
                          role="button" tabIndex={0}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") navigate("/appointments/doctors"); }}
                        >
                          <td className="py-2.5 pr-3 font-medium" style={{ color: T.ink1 }}>{doc.name}</td>
                          <td className="py-2.5 pr-3 text-[11px]" style={{ color: T.ink2 }}>{doc.specialization}</td>
                          <td className="py-2.5 pr-3 text-right">{doc.count}</td>
                          <td className="py-2.5 pr-3 text-right font-semibold" style={{ color: T.green }}>{doc.completed}</td>
                          <td className="py-2.5 text-right">
                            <Badge tone={rate >= 50 ? "ok" : rate > 0 ? "warn" : "neutral"}>
                              {rate > 0 ? `${rate}%` : "—"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </DCard>
          </>
        )}

        {/* Specialisation bar chart (recharts) — for visual depth */}
        {bySpecialization.length > 0 && (
          <>
            <SectionLabel>Volume by specialisation</SectionLabel>
            <DCard>
              <CardTitle hint="Top 8 departments">Appointment volume</CardTitle>
              <div className="h-52 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySpecialization.slice(0, 8)} layout="vertical" barCategoryGap="30%" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: T.ink3 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="specialization" width={100} tick={{ fontSize: 10, fill: T.ink3 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface }} />
                    <Bar dataKey="count" name="Appointments" fill={T.blue} radius={[0, 4, 4, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DCard>
          </>
        )}
      </DashPage>
    </AppLayout>
  );
}
