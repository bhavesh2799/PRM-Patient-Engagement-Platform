import { AppLayout } from "@/components/layout/AppLayout";
import { useGetAppointmentsDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-100 text-blue-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AppointmentsDashboard() {
  const { data: dashboard, isLoading } = useGetAppointmentsDashboard();

  const d = dashboard as any;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96 text-muted-foreground">Loading dashboard...</div>
      </AppLayout>
    );
  }
  if (!d) return null;

  const byStatus: any[] = d.byStatus ?? [];
  const byChannel: any[] = d.byChannel ?? [];
  const trend: any[] = d.trend ?? [];
  const byDoctor: any[] = d.byDoctor ?? [];
  const bySpecialization: any[] = d.bySpecialization ?? [];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Appointments Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Booking trends, doctor utilization, and channel attribution.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Appointments", value: (d.total ?? 0).toLocaleString("en-IN") },
            { label: "Completion Rate", value: `${d.completionRate ?? 0}%`, color: "text-green-600" },
            { label: "Cancellation Rate", value: `${d.cancellationRate ?? 0}%`, color: "text-red-500" },
            { label: "App Bookings", value: byChannel.find(c => c.channel === "app_booking")?.count ?? 0 },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
                <div className={`text-3xl font-bold ${color ?? ""}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">By Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-2">
                {byStatus.map((s: any) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {s.status}
                    </span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">By Specialization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySpecialization.slice(0, 6)} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="specialization" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Appointments" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Booking Trend — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" name="Booked" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {byDoctor.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Doctor Utilization</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left p-4 font-medium">Doctor</th>
                    <th className="text-left p-4 font-medium">Specialization</th>
                    <th className="text-right p-4 font-medium">Total</th>
                    <th className="text-right p-4 font-medium pr-6">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {byDoctor.map((d: any) => (
                    <tr key={d.doctorId} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="p-4 font-medium">{d.name}</td>
                      <td className="p-4 text-muted-foreground">{d.specialization}</td>
                      <td className="p-4 text-right">{d.count}</td>
                      <td className="p-4 text-right pr-6 text-green-600">{d.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
