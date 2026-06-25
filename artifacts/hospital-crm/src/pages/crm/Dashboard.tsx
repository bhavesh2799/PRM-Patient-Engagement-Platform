import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useGetSessionRole } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  T, DashPage, PageHead, DCard, CardTitle, SectionLabel, MetricCard,
  InsightStrip, ActionCard, FunnelSVG, Badge, Avatar, BadgeTone,
  nf, durationFromMinutes, type FunnelStage,
} from "@/components/dashboard/ui";

interface CrmDashboardData {
  totalLeads: number;
  newLeads: number;
  fulfilledLeads: number;
  closedLeads: number;
  inProgressLeads: number;
  conversionRate: number;
  slaBreach: number;
  slaBreachRate: number;
  leadAgeing: { lt6h: number; h6_24: number; h24_72: number; gt72: number };
  ageSummary: { critical: number; atRisk: number; onTime: number };
  byChannel: { channel: string; count: number; fulfilled: number; conversionRate: number }[];
  trend: { date: string; count: number }[];
  optOutRate: number;
  dndRate: number;
  ttfaMedianMinutes: number | null;
  ownerWorkload: {
    userId: number; name: string; role: string; idx: number;
    new: number; contacted: number; in_progress: number; fulfilled: number; total: number; breached: number;
  }[];
}

const CHANNEL_LABELS: Record<string, string> = {
  waba: "WhatsApp", web_chat: "Web Chat", form: "Web Form",
  email: "Email", csv: "CSV Import", walk_in: "Walk-in",
  app_booking: "App Appt.", web_booking: "Web Booking",
  medicine_order: "Medicine Order", lab_test: "Lab Test",
  web_appointment: "Web Appt.", app_appointment: "App Appt.",
};
const chLabel = (c: string) => CHANNEL_LABELS[c] ?? c;

function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }

export default function CrmDashboard() {
  const [channelFilter, setChannelFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [, navigate] = useLocation();

  const { data: session } = useGetSessionRole() as { data?: { role: string } };
  const canSeeWorkload = session?.role === "manager" || session?.role === "ap_admin";

  const params = new URLSearchParams();
  if (channelFilter !== "all") params.set("channel", channelFilter);
  if (ownerFilter) params.set("ownerId", ownerFilter);
  const paramStr = params.toString();

  const { data: d, isLoading } = useQuery<CrmDashboardData>({
    queryKey: ["crm-dashboard", channelFilter, ownerFilter],
    queryFn: () => fetch(`/api/dashboard/crm${paramStr ? `?${paramStr}` : ""}`).then(r => r.json()),
  });
  const { data: users = [] } = useQuery<{ id: number; name: string; role: string }[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then(r => r.json()),
  });

  if (isLoading) return (
    <AppLayout>
      <DashPage><div className="flex items-center justify-center h-96 text-sm" style={{ color: T.ink3 }}>Loading dashboard…</div></DashPage>
    </AppLayout>
  );
  if (!d) return null;

  const total = d.totalLeads ?? 0;
  const newLeads = d.newLeads ?? 0;
  const inProgress = d.inProgressLeads ?? 0;
  const fulfilled = d.fulfilledLeads ?? 0;
  const slaBreach = d.slaBreach ?? 0;
  const slaBreachRate = d.slaBreachRate ?? 0;
  const conversionRate = d.conversionRate ?? 0;
  const ttfa = d.ttfaMedianMinutes ?? null;
  const ageing = d.leadAgeing ?? { lt6h: 0, h6_24: 0, h24_72: 0, gt72: 0 };
  const ageSummary = d.ageSummary ?? { critical: 0, atRisk: 0, onTime: 0 };

  const channels = (d.byChannel ?? []).filter(c => c.count > 0).sort((a, b) => b.conversionRate - a.conversionRate || b.count - a.count);
  const bestChannel = channels[0];
  const worstChannel = [...channels].reverse().find(c => c.count >= 2);
  const owners = d.ownerWorkload ?? [];
  const topBreacher = owners[0];

  const funnel: FunnelStage[] = [
    { label: "Total", count: total, sub: "100%", color: T.blue, fill: "rgba(37,99,235,.85)" },
    { label: "Unactioned", count: newLeads, sub: `${pct(newLeads, total)}% stuck`, color: T.red, fill: "rgba(216,59,59,.8)" },
    { label: "In progress", count: inProgress, sub: `${pct(inProgress, total)}%`, color: T.amber, fill: "rgba(180,83,9,.85)" },
    { label: "Fulfilled", count: fulfilled, sub: `${conversionRate}% conv.`, color: T.green, fill: "rgba(26,148,104,.9)" },
  ];

  const projectedFulfilled = fulfilled + Math.round(newLeads * (conversionRate / 100));
  const improvement = fulfilled > 0 ? (projectedFulfilled / fulfilled).toFixed(1) : "—";

  const hasFilters = channelFilter !== "all" || !!ownerFilter;
  const selectStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: T.ink1, background: T.surface2,
    border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 9px", cursor: "pointer",
  };
  const chMax = Math.max(...channels.map(c => c.conversionRate), 1);
  const ageMax = Math.max(ageing.lt6h, ageing.h6_24, ageing.h24_72, ageing.gt72, 1);

  return (
    <AppLayout>
      <DashPage>
        <PageHead
          title="CRM Dashboard"
          subtitle="Lead performance, SLA tracking, team workload & channel insights"
          right={<span className="text-xs" style={{ color: T.ink3 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</span>}
        />

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap rounded-[10px] px-3.5 py-2.5 mb-5" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: T.ink3 }}>Filter</span>
          <select style={selectStyle} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
            <option value="all">All channels</option>
            {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select style={selectStyle} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
            <option value="">All owners</option>
            {users.filter(u => u.role !== "ap_admin").map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setChannelFilter("all"); setOwnerFilter(""); }} className="text-xs px-3 py-[5px] rounded-md" style={{ border: `1px solid ${T.border}`, color: T.ink1, background: T.surface }}>Clear</button>
          )}
        </div>

        {/* SLA alert */}
        {slaBreach > 0 && (
          <button
            onClick={() => navigate("/crm/inbox?status=new")}
            className="w-full flex items-center gap-3 rounded-[10px] px-4 py-3 mb-5 text-left transition-colors hover:brightness-[0.98]"
            style={{ background: T.redBg, border: `1px solid #FECACA`, color: "#991B1B" }}
          >
            <span className="text-base">⚠</span>
            <span className="text-[13px] font-medium flex-1">{slaBreach} lead{slaBreach !== 1 ? "s" : ""} breached 24h SLA — unactioned &amp; still "New". Immediate action required.</span>
            <span className="text-[12px] underline opacity-70">View in inbox →</span>
          </button>
        )}

        {/* Pipeline overview */}
        <SectionLabel>Pipeline overview</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <MetricCard accent={T.blue} label="Total leads" value={nf(total)} sub="Last 14 days" />
          <MetricCard accent={T.red} label="New / unactioned" value={nf(newLeads)} valueColor={T.red} delta={`${pct(newLeads, total)}% of pipeline at risk`} deltaTone="down" />
          <MetricCard accent="#F59E0B" label="In progress" value={nf(inProgress)} valueColor={T.amber} sub="Open cases" />
          <MetricCard accent={T.green} label="Fulfilled" value={nf(fulfilled)} valueColor={T.green} delta={`${conversionRate}% conversion`} deltaTone="up" />
          <MetricCard accent={T.red} label="SLA breach rate" value={`${slaBreachRate}%`} valueColor={T.red} sub={`${slaBreach} of ${total} · Target: 0%`} />
        </div>

        {/* Speed & quality */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
          <MetricCard
            label="Median time-to-first-action"
            value={<span className="text-[22px]">{durationFromMinutes(ttfa)}</span>}
            valueColor={ttfa != null && ttfa > 1440 ? T.red : T.ink1}
            delta={ttfa != null && ttfa > 1440 ? `${(ttfa / 1440).toFixed(0)}× over 24h target` : "Within 24h target"}
            deltaTone={ttfa != null && ttfa > 1440 ? "down" : "up"}
            progress={{ pct: ttfa != null ? Math.min(100, (ttfa / 1440) * 100) : 0, color: ttfa != null && ttfa > 1440 ? T.red : T.green }}
          />
          <MetricCard
            label="Overall conversion rate"
            value={<span className="text-[22px]">{conversionRate}%</span>}
            sub={`${fulfilled} fulfilled of ${total} total`}
            progress={{ pct: conversionRate, color: T.green }}
          />
          <MetricCard
            label="Opt-out / DND exposure"
            value={<span className="text-[22px]">{Math.max(d.optOutRate ?? 0, d.dndRate ?? 0)}%</span>}
            sub={`${d.optOutRate ?? 0}% opted out · ${d.dndRate ?? 0}% DND listed`}
            progress={{ pct: Math.max(d.optOutRate ?? 0, d.dndRate ?? 0), color: T.ink3 }}
          />
        </div>

        {/* Funnel + channel */}
        <SectionLabel>Conversion funnel &amp; channel performance</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <DCard>
            <CardTitle hint="Stage-by-stage drop-off">Lead funnel</CardTitle>
            <FunnelSVG stages={funnel} />
            {newLeads > 0 && (
              <InsightStrip tone="amber">
                <strong>Biggest blockage:</strong> {pct(newLeads, total)}% of leads never leave "New." If those {newLeads} were actioned on time, projected fulfilled could reach {projectedFulfilled} — a <strong>{improvement}× improvement</strong>.
              </InsightStrip>
            )}
          </DCard>

          <DCard>
            <CardTitle hint="Rate × volume">Channel conversion rates</CardTitle>
            {channels.length === 0 && <div className="text-[12px] py-4" style={{ color: T.ink3 }}>No data for selected filters.</div>}
            {channels.map(c => {
              const isBest = c.channel === bestChannel?.channel && c.conversionRate > 0;
              const isFix = c.conversionRate === 0 && c.count >= 2;
              const barColor = isFix ? T.red : c.conversionRate >= 50 ? T.green : T.blue;
              return (
                <button key={c.channel} onClick={() => navigate(`/crm/inbox?channel=${c.channel}`)} className="w-full flex items-center gap-2.5 mb-2.5 group">
                  <div className="text-[12px] text-right shrink-0" style={{ color: T.ink2, width: 96 }}>{chLabel(c.channel)}</div>
                  <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: T.surface2 }}>
                    <div className="h-2 rounded" style={{ width: `${Math.max((c.conversionRate / chMax) * 100, isFix ? 3 : 2)}%`, background: barColor }} />
                  </div>
                  <div className="text-[12px] font-semibold text-right shrink-0" style={{ width: 38, color: T.ink1 }}>{c.conversionRate}%</div>
                  <div className="shrink-0" style={{ width: 44 }}>
                    {isBest && <Badge tone="ok">Best</Badge>}
                    {isFix && <Badge tone="danger">Fix</Badge>}
                  </div>
                </button>
              );
            })}
            {worstChannel && worstChannel.conversionRate === 0 && (
              <InsightStrip tone="red">
                <strong>{chLabel(worstChannel.channel)} converts at 0% across {worstChannel.count} leads.</strong> Leads may be unassigned or response times too slow. Check inbox filters for this channel.
              </InsightStrip>
            )}
          </DCard>
        </div>

        {/* Owner workload + lead ageing */}
        {canSeeWorkload && (
          <>
            <SectionLabel>Team accountability &amp; urgency</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <DCard>
                <CardTitle>Owner workload</CardTitle>
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
                    {owners.map((o, i) => (
                      <tr key={o.userId} style={{ borderTop: `1px solid ${T.border2}` }}>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={o.name} index={o.idx ?? i} />
                            <div>
                              <div className="font-medium" style={{ color: T.ink1 }}>{o.name}</div>
                              {i === 0 && o.breached > 0 ? <div className="text-[10px]" style={{ color: T.ink3 }}>Most overloaded</div>
                                : o.breached === 0 ? <div className="text-[10px]" style={{ color: T.green }}>Best performer</div> : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 font-semibold">{o.total}</td>
                        <td className="py-2">{o.in_progress}</td>
                        <td className="py-2">{o.fulfilled}</td>
                        <td className="py-2"><Badge tone={o.breached === 0 ? "ok" : o.breached >= 5 ? "danger" : "warn"}>{o.breached} breached</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {topBreacher && topBreacher.breached > 0 && slaBreach > 0 && (
                  <InsightStrip tone="amber">
                    <strong>{topBreacher.name} accounts for {pct(topBreacher.breached, slaBreach)}% of all SLA breaches</strong> with {pct(topBreacher.total, total)}% of leads. Consider redistributing leads or reviewing their workflow.
                  </InsightStrip>
                )}
              </DCard>

              <DCard>
                <CardTitle>Lead ageing — unactioned</CardTitle>
                {[
                  { label: "< 6h", v: ageing.lt6h, c: T.green, badge: <Badge tone="ok">Safe</Badge> },
                  { label: "6–24h", v: ageing.h6_24, c: T.amber, badge: <Badge tone="warn">Watch</Badge> },
                  { label: "24–72h", v: ageing.h24_72, c: T.red, badge: <Badge tone="danger">Urgent</Badge> },
                  { label: "> 72h", v: ageing.gt72, c: "#7F1D1D", badge: <Badge tone="danger">Critical</Badge> },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-2.5 mb-2.5">
                    <div className="text-[12px] shrink-0" style={{ color: T.ink2, width: 64 }}>{b.label}</div>
                    <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: T.surface2 }}>
                      <div className="h-2 rounded" style={{ width: `${Math.max((b.v / ageMax) * 100, 2)}%`, background: b.c }} />
                    </div>
                    <div className="text-[12px] font-medium text-right shrink-0" style={{ width: 50, color: T.ink1 }}>{b.v} lead{b.v !== 1 ? "s" : ""}</div>
                    <div className="shrink-0" style={{ width: 56 }}>{b.badge}</div>
                  </div>
                ))}
                <div className="h-px my-3" style={{ background: T.border2 }} />
                <div className="text-[12px] mb-3" style={{ color: T.ink2 }}>Unactioned lead summary</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg px-3 py-2.5" style={{ background: T.redBg }}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: "#991B1B" }}>Critical (&gt;72h)</div>
                    <div className="text-[20px] font-bold mt-0.5" style={{ color: T.red }}>{ageSummary.critical}</div>
                    <div className="text-[11px]" style={{ color: T.ink3 }}>Immediate escalation needed</div>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: T.amberBg }}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: "#92400E" }}>At risk (24–72h)</div>
                    <div className="text-[20px] font-bold mt-0.5" style={{ color: T.amber }}>{ageSummary.atRisk}</div>
                    <div className="text-[11px]" style={{ color: T.ink3 }}>Act within next 2h</div>
                  </div>
                </div>
                {slaBreach > 0 && (
                  <InsightStrip tone="red">
                    <strong>{slaBreach} breached lead{slaBreach !== 1 ? "s" : ""} need action today.</strong> {ageing.gt72} are over 72h old — escalate these to a senior team member immediately.
                  </InsightStrip>
                )}
              </DCard>
            </div>
          </>
        )}

        {/* Recommended actions */}
        <SectionLabel>Recommended actions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard tone="red" eyebrow="Do now" title={`Escalate ${ageSummary.critical} critical lead${ageSummary.critical !== 1 ? "s" : ""} (>72h)`} body="Assign to an available exec or supervisor. Each hour increases drop-off risk." />
          <ActionCard tone="amber" eyebrow="Do today" title={worstChannel && worstChannel.conversionRate === 0 ? `Audit ${chLabel(worstChannel.channel)} pipeline` : "Review stalled channels"} body="Channels showing 0% conversion despite volume need assignment-rule and response-workflow checks." />
          <ActionCard tone="green" eyebrow="Do this week" title={topBreacher && topBreacher.breached > 0 ? `Redistribute ${topBreacher.name}'s queue` : "Balance team workload"} body="SLA breaches concentrating in one owner suggest the need to balance load or add a 4h check-in rule." />
        </div>
      </DashPage>
    </AppLayout>
  );
}
