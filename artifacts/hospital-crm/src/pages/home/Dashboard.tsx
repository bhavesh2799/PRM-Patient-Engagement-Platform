import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  T, DashPage, PageHead, DCard, CardTitle, SectionLabel, MetricCard,
  StatMini, BarRow, FunnelSVG, Badge, Avatar, BadgeTone,
  nf, compactInr, inr, durationFromMinutes, type FunnelStage,
} from "@/components/dashboard/ui";

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp", web_chat: "Web Chat", form: "Web Form",
  email: "Email", csv: "CSV Import", walk_in: "Walk-in",
  app_booking: "App Appt.", web_booking: "Web Booking",
  medicine_order: "Medicine Order", lab_test: "Lab Test",
  web_appointment: "Web Appt.", app_appointment: "App Appt.",
};
const chLabel = (c: string) => CHANNEL_LABELS[c] ?? c;

const STATUS_BADGE: Record<string, { tone: BadgeTone; label: string }> = {
  new: { tone: "neutral", label: "New" },
  contacted: { tone: "warn", label: "Contacted" },
  in_progress: { tone: "info", label: "In progress" },
  fulfilled: { tone: "ok", label: "Fulfilled" },
  closed: { tone: "neutral", label: "Closed" },
};

const CAMPAIGN_CHANNEL_BADGE: Record<string, BadgeTone> = {
  waba: "purple", sms: "info", push: "purple", email: "info",
};
const CAMPAIGN_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  live: { tone: "ok", label: "● Live" },
  paused: { tone: "warn", label: "⏸ Paused" },
  completed: { tone: "neutral", label: "Done" },
};

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor(ms / 60000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}
function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function buildQs(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  return qs.toString() ? `?${qs}` : "";
}
function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }

const STACK_COLORS = { new: "#6EAAF7", contacted: "#E8A838", in_progress: "#50B892", fulfilled: T.green };

export default function HomeDashboard() {
  const [, navigate] = useLocation();
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [period, setPeriod] = useState("14d");

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard-home", channelFilter, statusFilter, period],
    queryFn: async () => {
      const days = period === "7d" ? 7 : 14;
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const qs = buildQs({ channel: channelFilter, status: statusFilter, dateFrom });
      const r = await fetch(`/api/dashboard/home${qs}`);
      return r.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <DashPage>
          <div className="flex items-center justify-center h-96 text-sm" style={{ color: T.ink3 }}>Loading…</div>
        </DashPage>
      </AppLayout>
    );
  }
  if (!dashboard) return null;
  const d = dashboard as any;

  const totalLeads: number = d.totalLeads ?? 0;
  const newLeads: number = d.newLeads ?? 0;
  const inProgress: number = d.inProgressLeads ?? 0;
  const converted: number = d.convertedLeads ?? 0;
  const conversionRate: number = d.conversionRate ?? 0;
  const slaBreach: number = d.slaBreach ?? 0;
  const slaBreachRate: number = d.slaBreachRate ?? 0;
  const ttfa: number | null = d.ttfaMedianMinutes ?? null;
  const ageing = d.leadAgeing ?? { lt6h: 0, h6_24: 0, h24_72: 0, gt72: 0 };
  const ageSummary = d.ageSummary ?? { critical: 0, atRisk: 0, onTime: 0 };

  const appt = d.appointmentSummary ?? {};
  const apptBooked = (appt.booked ?? 0) + (appt.confirmed ?? 0);
  const apptFulfilled = appt.completed ?? 0;

  const out = d.outreach ?? { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, spend: 0, revenue: 0, roas: 0 };
  const activeCampaigns = d.activeCampaigns ?? { total: 0, live: 0, paused: 0 };
  const revenue: number = d.revenueAttributed ?? 0;

  const ownerWorkload: any[] = d.ownerWorkload ?? [];
  const slaWatchlist: any[] = d.slaWatchlist ?? [];
  const activeCampaignsList: any[] = d.activeCampaignsList ?? [];
  const recentLeads: any[] = d.recentLeads ?? [];
  const leadToOutcome: any[] = (d.leadToOutcomeByChannel ?? []).slice().sort((a: any, b: any) => {
    const at = a.new + a.contacted + a.in_progress + a.fulfilled;
    const bt = b.new + b.contacted + b.in_progress + b.fulfilled;
    return bt - at;
  });

  const leadFunnel: FunnelStage[] = [
    { label: "Total", count: totalLeads, sub: "100%", color: T.blue, fill: "rgba(37,99,235,.85)" },
    { label: "Unactioned", count: newLeads, sub: `${pct(newLeads, totalLeads)}% stuck`, color: T.red, fill: "rgba(216,59,59,.8)" },
    { label: "In progress", count: inProgress, sub: `${pct(inProgress, totalLeads)}%`, color: T.amber, fill: "rgba(180,83,9,.85)" },
    { label: "Fulfilled", count: converted, sub: `${conversionRate}% conv.`, color: T.green, fill: "rgba(26,148,104,.9)" },
  ];
  const outFunnel: FunnelStage[] = [
    { label: "Sent", count: out.sent, sub: "100%", color: T.blue, fill: "rgba(37,99,235,.85)" },
    { label: "Delivered", count: out.delivered, sub: `${pct(out.delivered, out.sent)}%`, color: T.blue, fill: "rgba(37,99,235,.5)" },
    { label: "Opened", count: out.opened, sub: `${pct(out.opened, out.sent)}%`, color: T.purple, fill: "rgba(124,58,237,.85)" },
    { label: "Clicked", count: out.clicked, sub: `${pct(out.clicked, out.sent)}%`, color: T.amber, fill: "rgba(180,83,9,.9)" },
    { label: "Converted", count: out.converted, sub: `${pct(out.converted, out.sent)}%`, color: T.green, fill: "rgba(26,148,104,.9)" },
  ];

  const ageMax = Math.max(ageing.lt6h, ageing.h6_24, ageing.h24_72, ageing.gt72, 1);
  const selectStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: T.ink1, background: T.surface2,
    border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 9px", cursor: "pointer",
  };

  return (
    <AppLayout>
      <DashPage>
        <PageHead
          title="Overview"
          subtitle="Leads, outreach & appointments — all channels"
          right={<span className="text-xs" style={{ color: T.ink3 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</span>}
        />

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap rounded-[10px] px-3.5 py-2.5 mb-5" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: T.ink3 }}>Filter</span>
          <select style={selectStyle} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
            <option value="">All channels</option>
            {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select style={selectStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="in_progress">In progress</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="closed">Closed</option>
          </select>
          <select style={selectStyle} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
            <option value="mtd">Month to date</option>
          </select>
          {(channelFilter || statusFilter) && (
            <button onClick={() => { setChannelFilter(""); setStatusFilter(""); }} className="text-xs px-3 py-[5px] rounded-md" style={{ border: `1px solid ${T.border}`, color: T.ink1, background: T.surface }}>Clear</button>
          )}
        </div>

        {/* Pulse strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <MetricCard
            accent={T.red}
            label="Unactioned leads"
            value={newLeads}
            valueColor={T.red}
            sub={`of ${nf(totalLeads)} total · ${pct(newLeads, totalLeads)}% of pipeline`}
            delta={<Badge tone="danger">{slaBreach} SLA breached</Badge>}
            onClick={() => navigate("/crm/inbox")}
          />
          <MetricCard
            accent={T.green}
            label="Patients reached (MTD)"
            value={nf(out.sent)}
            valueColor={T.green}
            sub={`${activeCampaigns.total} campaigns · ${pct(out.delivered, out.sent)}% delivery`}
            delta={<Badge tone="ok">↑ {nf(out.delivered)} delivered</Badge>}
            onClick={() => navigate("/marketing/campaigns")}
          />
          <MetricCard
            accent="#F59E0B"
            label="Appointments booked"
            value={apptBooked}
            valueColor={T.amber}
            sub={`This period · ${apptFulfilled} completed`}
            delta={<Badge tone="warn">{conversionRate}% conversion rate</Badge>}
            onClick={() => navigate("/appointments/bookings")}
          />
          <MetricCard
            accent={T.blue}
            label="Revenue attributed"
            value={compactInr(revenue)}
            valueColor={T.blue}
            sub={`UHID-matched · ${out.roas}× ROAS`}
            delta={<Badge tone="info">{inr(out.spend, 2)} spend</Badge>}
            onClick={() => navigate("/marketing/campaigns")}
          />
        </div>

        {/* Row 1 — Lead pipeline | Outreach */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DCard>
            <CardTitle hint="Incoming · all channels">Lead pipeline</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <StatMini label="Total" value={nf(totalLeads)} sub="All channels" />
              <StatMini label="Unactioned" value={nf(newLeads)} valueColor={T.red} sub={`${pct(newLeads, totalLeads)}% of pipeline`} />
              <StatMini label="In progress" value={nf(inProgress)} valueColor={T.blue} sub="Open cases" />
              <StatMini label="Fulfilled" value={nf(converted)} valueColor={T.green} sub={`${conversionRate}% conversion`} />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatMini label="SLA breach rate" value={<span className="text-[18px]">{slaBreachRate}%</span>} valueColor={T.red} sub={`${slaBreach} of ${totalLeads} leads`} />
              <StatMini label="Time to first action" value={<span className="text-[18px]">{durationFromMinutes(ttfa)}</span>} valueColor={ttfa != null && ttfa > 1440 ? T.red : T.ink1} sub="Target: 24h" />
              <StatMini label="Conversion rate" value={<span className="text-[18px]">{conversionRate}%</span>} valueColor={T.green} sub={`${converted} of ${totalLeads}`} />
            </div>
            <SectionLabel>Lead funnel — stage breakdown</SectionLabel>
            <FunnelSVG stages={leadFunnel} />
          </DCard>

          <DCard>
            <CardTitle hint="All campaigns · MTD">Outreach performance</CardTitle>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatMini label="Sent" value={nf(out.sent)} sub={`${activeCampaigns.total} campaigns`} />
              <StatMini label="Delivered" value={nf(out.delivered)} valueColor={T.green} sub={`${pct(out.delivered, out.sent)}% delivery`} />
              <StatMini label="Conversions" value={nf(out.converted)} valueColor={T.green} sub={`${pct(out.converted, out.sent)}% of sent`} />
            </div>
            <SectionLabel>Aggregated funnel — all campaigns</SectionLabel>
            <FunnelSVG stages={outFunnel} />
            <div className="h-px my-3" style={{ background: T.border2 }} />
            <SectionLabel>ROI</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              <StatMini label="Spend" value={<span className="text-[16px]">{inr(out.spend, 2)}</span>} sub="MTD total" />
              <StatMini label="Revenue" value={<span className="text-[16px]">{compactInr(out.revenue)}</span>} valueColor={T.green} sub="UHID-matched" />
              <StatMini label="ROAS" value={<span className="text-[16px]">{out.roas}×</span>} valueColor={T.blue} sub="Revenue ÷ Spend" />
            </div>
          </DCard>
        </div>

        {/* Lead-to-outcome by channel */}
        <DCard className="mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <span className="text-[13px] font-semibold" style={{ color: T.ink1 }}>Lead-to-outcome by channel</span>
            <div className="flex items-center gap-3.5 text-[11px]" style={{ color: T.ink2 }}>
              {[["New", STACK_COLORS.new], ["Contacted", STACK_COLORS.contacted], ["In progress", STACK_COLORS.in_progress], ["Fulfilled", STACK_COLORS.fulfilled]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c as string }} />{l}</span>
              ))}
            </div>
          </div>
          {leadToOutcome.map((row: any) => {
            const tot = row.new + row.contacted + row.in_progress + row.fulfilled;
            return (
              <div key={row.channel} className="flex items-center gap-2.5 mb-2.5">
                <div className="text-[12px] text-right shrink-0" style={{ color: T.ink2, width: 120 }}>{chLabel(row.channel)}</div>
                <div className="flex-1 flex h-[18px] rounded overflow-hidden" style={{ background: T.surface2 }}>
                  {(["new", "contacted", "in_progress", "fulfilled"] as const).map(k => row[k] > 0 && (
                    <div key={k} style={{ width: `${(row[k] / tot) * 100}%`, background: STACK_COLORS[k] }} title={`${k}: ${row[k]}`} />
                  ))}
                </div>
                <div className="text-[12px] font-semibold text-right shrink-0" style={{ width: 28 }}>{tot}</div>
              </div>
            );
          })}
        </DCard>

        {/* Owner workload | Lead ageing */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DCard>
            <CardTitle hint="Leads assigned + SLA breach">Owner workload</CardTitle>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.06em]" style={{ color: T.ink3 }}>
                  <th className="text-left font-semibold pb-2">Owner</th>
                  <th className="text-left font-semibold pb-2">Assigned</th>
                  <th className="text-left font-semibold pb-2">In prog.</th>
                  <th className="text-left font-semibold pb-2">Fulfilled</th>
                  <th className="text-left font-semibold pb-2">SLA status</th>
                </tr>
              </thead>
              <tbody>
                {ownerWorkload.map((o: any, i: number) => (
                  <tr key={o.userId} style={{ borderTop: `1px solid ${T.border2}` }}>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={o.name} index={o.idx ?? i} />
                        <div>
                          <div className="font-medium" style={{ color: T.ink1 }}>{o.name}</div>
                          {i === 0 && o.breached > 0 && <div className="text-[10px]" style={{ color: T.ink3 }}>Most overloaded</div>}
                          {o.breached === 0 && <div className="text-[10px]" style={{ color: T.green }}>On track</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 font-semibold">{o.total}</td>
                    <td className="py-2">{o.in_progress}</td>
                    <td className="py-2">{o.fulfilled}</td>
                    <td className="py-2">
                      <Badge tone={o.breached === 0 ? "ok" : o.breached >= 5 ? "danger" : "warn"}>{o.breached} breached</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DCard>

          <DCard>
            <CardTitle hint="Unactioned · by age">Lead ageing</CardTitle>
            <div className="grid grid-cols-4 gap-2 mb-3.5">
              {[
                { label: "< 6h", v: ageing.lt6h, c: T.green, bg: T.greenBg, note: "On time" },
                { label: "6–24h", v: ageing.h6_24, c: T.amber, bg: T.amberBg, note: "Watch" },
                { label: "24–72h", v: ageing.h24_72, c: T.red, bg: T.redBg, note: "Urgent" },
                { label: "> 72h", v: ageing.gt72, c: "#7F1D1D", bg: "#FEF2F2", note: "Critical" },
              ].map(b => (
                <div key={b.label} className="rounded-lg px-3 py-2.5 text-center" style={{ background: b.bg }}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.05em] mb-1" style={{ color: b.c }}>{b.label}</div>
                  <div className="text-[20px] font-bold" style={{ color: b.c }}>{b.v}</div>
                  <div className="text-[10px]" style={{ color: T.ink3 }}>{b.note}</div>
                </div>
              ))}
            </div>
            <BarRow label="< 6h" pct={(ageing.lt6h / ageMax) * 100} color={T.green} value={ageing.lt6h} labelWidth={56} />
            <BarRow label="6–24h" pct={(ageing.h6_24 / ageMax) * 100} color={T.amber} value={ageing.h6_24} labelWidth={56} />
            <BarRow label="24–72h" pct={(ageing.h24_72 / ageMax) * 100} color={T.red} value={ageing.h24_72} labelWidth={56} />
            <BarRow label="> 72h" pct={(ageing.gt72 / ageMax) * 100} color="#7F1D1D" value={ageing.gt72} labelWidth={56} />
          </DCard>
        </div>

        {/* Active campaigns */}
        <DCard className="mb-4 overflow-x-auto">
          <CardTitle hint="Live, paused & recently completed">Active campaigns</CardTitle>
          <table className="w-full text-[12px]" style={{ minWidth: 900 }}>
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.06em]" style={{ color: T.ink3 }}>
                {["Campaign", "Goal", "Channel", "Sent", "Delivery", "Open", "CTR", "Conversions", "Revenue", "Cost/conv.", "Status"].map(h => (
                  <th key={h} className="text-left font-semibold pb-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCampaignsList.map((c: any) => {
                const st = CAMPAIGN_STATUS[c.status] ?? { tone: "neutral" as BadgeTone, label: c.status };
                const hasMetrics = c.reached > 0;
                return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${T.border2}` }} className="cursor-pointer hover:bg-[#FAFAF8]" onClick={() => navigate(`/marketing/metrics?campaign=${c.id}`)}>
                    <td className="py-2.5 pr-3 font-medium" style={{ color: T.ink1 }}>{c.name}</td>
                    <td className="py-2.5 pr-3 text-[11px]" style={{ color: T.ink2 }}>{c.goal || "—"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={CAMPAIGN_CHANNEL_BADGE[c.channel] ?? "neutral"}>{chLabel(c.channel)}</Badge></td>
                    <td className="py-2.5 pr-3">{nf(c.reached)}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-11 h-1 rounded-sm overflow-hidden" style={{ background: T.surface2 }}>
                          <div className="h-1 rounded-sm" style={{ width: `${c.deliveryRate}%`, background: c.deliveryRate >= 85 ? T.green : T.amber }} />
                        </div>
                        <span className="font-semibold" style={{ color: c.deliveryRate >= 85 ? T.green : T.amber }}>{c.deliveryRate}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: hasMetrics ? T.purple : T.ink4 }}>{hasMetrics ? `${c.openRate}%` : "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: hasMetrics ? T.amber : T.ink4 }}>{hasMetrics ? `${c.ctr}%` : "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: T.green }}>{c.conversions || "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: c.revenueAttributed > 0 ? T.green : T.ink4 }}>{c.revenueAttributed > 0 ? compactInr(c.revenueAttributed) : "—"}</td>
                    <td className="py-2.5 pr-3">{c.costPerConversion > 0 ? inr(c.costPerConversion) : "—"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DCard>

        {/* SLA breach watchlist */}
        <DCard className="mb-4">
          <CardTitle hint="Unactioned leads · sorted by age">SLA breach watchlist</CardTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              {slaWatchlist.length === 0 && <div className="text-[12px] py-4" style={{ color: T.ink3 }}>No unactioned leads — all caught up.</div>}
              {slaWatchlist.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${T.border2}` }}>
                  <div>
                    <div className="text-[12px] font-medium" style={{ color: T.ink1 }}>{l.name}</div>
                    <div className="text-[11px]" style={{ color: T.ink3 }}>
                      {chLabel(l.channel)}{l.campaignTouchName ? ` · ${l.campaignTouchName}` : ""}{l.ownerName ? ` · ${l.ownerName}` : " · Unassigned"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] font-semibold" style={{ color: T.red }}>{durationFromMinutes(l.ageHours * 60)} old</div>
                    <Badge tone="neutral">New</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg px-3.5 py-3 text-center" style={{ background: T.redBg }}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.05em] mb-1" style={{ color: T.red }}>Critical</div>
                  <div className="text-[22px] font-bold" style={{ color: T.red }}>{ageSummary.critical}</div>
                  <div className="text-[10px]" style={{ color: T.ink3 }}>&gt;72h old</div>
                </div>
                <div className="rounded-lg px-3.5 py-3 text-center" style={{ background: T.amberBg }}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.05em] mb-1" style={{ color: T.amber }}>At risk</div>
                  <div className="text-[22px] font-bold" style={{ color: T.amber }}>{ageSummary.atRisk}</div>
                  <div className="text-[10px]" style={{ color: T.ink3 }}>24–72h old</div>
                </div>
                <div className="rounded-lg px-3.5 py-3 text-center" style={{ background: T.greenBg }}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.05em] mb-1" style={{ color: T.green }}>On time</div>
                  <div className="text-[22px] font-bold" style={{ color: T.green }}>{ageSummary.onTime}</div>
                  <div className="text-[10px]" style={{ color: T.ink3 }}>&lt;24h old</div>
                </div>
              </div>
              <div className="mt-1">
                <BarRow label="< 6h" pct={(ageing.lt6h / ageMax) * 100} color={T.green} value={ageing.lt6h} labelWidth={60} />
                <BarRow label="6–24h" pct={(ageing.h6_24 / ageMax) * 100} color={T.amber} value={ageing.h6_24} labelWidth={60} />
                <BarRow label="24–72h" pct={(ageing.h24_72 / ageMax) * 100} color={T.red} value={ageing.h24_72} labelWidth={60} />
                <BarRow label="> 72h" pct={(ageing.gt72 / ageMax) * 100} color="#7F1D1D" value={ageing.gt72} labelWidth={60} />
              </div>
            </div>
          </div>
        </DCard>

        {/* Recent leads */}
        <DCard className="overflow-x-auto">
          <CardTitle hint="Last action & campaign touch">Recent leads</CardTitle>
          <table className="w-full text-[12px]" style={{ minWidth: 760 }}>
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.06em]" style={{ color: T.ink3 }}>
                {["Patient", "Channel", "Status", "Last action", "Campaign touch", "Created"].map(h => (
                  <th key={h} className="text-left font-semibold pb-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((l: any) => {
                const sb = STATUS_BADGE[l.status] ?? { tone: "neutral" as BadgeTone, label: l.status };
                const noAction = l.status === "new";
                return (
                  <tr key={l.id} style={{ borderTop: `1px solid ${T.border2}` }} className="cursor-pointer hover:bg-[#FAFAF8]" onClick={() => navigate(`/crm/inbox?lead=${l.id}`)}>
                    <td className="py-2.5 pr-3 font-medium" style={{ color: T.ink1 }}>{l.firstName} {l.lastName}</td>
                    <td className="py-2.5 pr-3" style={{ color: T.ink2 }}>{chLabel(l.sourceChannel)}</td>
                    <td className="py-2.5 pr-3"><Badge tone={sb.tone}>{sb.label}</Badge></td>
                    <td className="py-2.5 pr-3" style={{ color: noAction ? T.red : T.ink2 }}>{timeAgo(l.lastActionAt)} · {l.lastActionDescription}</td>
                    <td className="py-2.5 pr-3">{l.campaignTouchName ? <span style={{ color: T.green }}>{l.campaignTouchName}</span> : <span style={{ color: T.ink4 }}>—</span>}</td>
                    <td className="py-2.5 pr-3 text-[11px]" style={{ color: T.ink3 }}>{shortDate(l.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DCard>
      </DashPage>
    </AppLayout>
  );
}
