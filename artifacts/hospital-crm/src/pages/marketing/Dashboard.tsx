import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { useGetWallet } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  T, DashPage, PageHead, DCard, CardTitle, SectionLabel, MetricCard,
  StatMini, BenchmarkBar, ActionCard, FunnelSVG, Badge, BadgeTone,
  nf, inr, compactInr, type FunnelStage,
} from "@/components/dashboard/ui";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", waba: "WhatsApp", web_chat: "Web Chat",
  email: "Email", sms: "SMS", push: "Push",
};
const chLabel = (c: string) => CHANNEL_LABELS[c] ?? c;
const CHANNEL_BADGE: Record<string, BadgeTone> = { whatsapp: "purple", waba: "purple", sms: "info", email: "info", web_chat: "info", push: "purple" };

const CAMPAIGN_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  live: { tone: "ok", label: "● Live" },
  completed: { tone: "neutral", label: "Completed" },
  paused: { tone: "warn", label: "⏸ Paused" },
  submitted: { tone: "info", label: "Submitted" },
  approved: { tone: "ok", label: "Approved" },
  draft: { tone: "neutral", label: "Draft" },
  failed: { tone: "danger", label: "Failed" },
};
const STATUS_NOTE: Record<string, string> = {
  live: "Sending now", completed: "Completed", paused: "Paused",
  submitted: "Awaiting approval", approved: "Ready to launch", draft: "Not yet submitted", failed: "Delivery failed",
};

const BENCHMARKS = { delivery: 82, open: 40, ctr: 18, conv: 5 };

function buildQs(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  return qs.toString() ? `?${qs}` : "";
}

function periodToDateFrom(period: string): string {
  if (period === "7d") return new Date(Date.now() - 7 * 86400_000).toISOString();
  if (period === "30d") return new Date(Date.now() - 30 * 86400_000).toISOString();
  // "mtd" — start of current month
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default function MarketingDashboard() {
  const [, navigate] = useLocation();
  const { data: wallet } = useGetWallet();
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [period, setPeriod] = useState("mtd");

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["engagement-dashboard", period],
    queryFn: async () => {
      const dateFrom = periodToDateFrom(period);
      const qs = buildQs({ dateFrom });
      const r = await fetch(`/api/dashboard/engagement${qs}`);
      return r.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <DashPage><div className="flex items-center justify-center h-96 text-sm" style={{ color: T.ink3 }}>Loading…</div></DashPage>
      </AppLayout>
    );
  }
  const d = dashboard as any;
  if (!d) return null;

  const isLowBalance = wallet && (wallet.balance as number) < 5000;

  const patientsReached: number = d.patientsReachedMtd ?? 0;
  const deliveryRate: number = d.deliveryRate ?? 0;
  const totalConversions: number = d.totalConversions ?? 0;
  const activeCampaigns: number = d.activeCampaigns ?? 0;
  const totalSpend: number = d.totalSpend ?? 0;
  const totalRevenue: number = d.totalRevenue ?? 0;
  const roi: number = d.roi ?? 0;
  const roas: number = d.roas ?? 0;
  const costPerPatient: number = d.costPerPatient ?? 0;
  const convPct = patientsReached > 0 ? Math.round((totalConversions / patientsReached) * 1000) / 10 : 0;
  const avgBooking = totalConversions > 0 ? Math.round(totalRevenue / totalConversions) : 0;

  const recentCampaigns: any[] = d.recentCampaigns ?? [];
  const fc = d.featuredCampaign as any | null;

  const periodLabel = period === "7d" ? "Last 7 days" : period === "30d" ? "Last 30 days" : "Month to date";

  const filtered = recentCampaigns.filter((c: any) => {
    const ch = (c.channel ?? "").toLowerCase();
    if (filterChannel && ch !== filterChannel && !(filterChannel === "whatsapp" && (ch === "waba"))) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  const selectStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: T.ink1, background: T.surface2,
    border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 9px", cursor: "pointer",
  };

  const fcFunnel: FunnelStage[] = fc ? [
    { label: "Sent", count: fc.sent, sub: "100%", color: T.blue, fill: "rgba(37,99,235,.9)" },
    { label: "Delivered", count: fc.delivered, sub: `${pct(fc.delivered, fc.sent)}%`, color: T.blue, fill: "rgba(37,99,235,.55)" },
    { label: "Opened", count: fc.opened, sub: `${pct(fc.opened, fc.sent)}%`, color: T.purple, fill: "rgba(124,58,237,.85)" },
    { label: "Clicked", count: fc.clicked, sub: `${pct(fc.clicked, fc.sent)}%`, color: T.amber, fill: "rgba(245,158,11,.9)" },
    { label: "Converted", count: fc.converted, sub: `${pct(fc.converted, fc.sent)}%`, color: T.green, fill: "rgba(26,148,104,.9)" },
  ] : [];

  const fcDeliveryRate = fc && fc.sent > 0 ? Math.round((fc.delivered / fc.sent) * 1000) / 10 : 0;
  const fcOpenRate = fc && fc.delivered > 0 ? Math.round((fc.opened / fc.delivered) * 1000) / 10 : 0;
  const fcCtr = fc && fc.delivered > 0 ? Math.round((fc.clicked / fc.delivered) * 1000) / 10 : 0;
  const fcConvRate = fc && fc.sent > 0 ? Math.round((fc.converted / fc.sent) * 1000) / 10 : 0;
  const fcRoas = fc ? fc.roas : 0;

  return (
    <AppLayout>
      <DashPage>
        <PageHead
          title="Engagement Dashboard"
          subtitle="Outreach performance, campaign ROI & channel efficiency"
          right={<span className="text-xs" style={{ color: T.ink3 }}>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
        />

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap rounded-[10px] px-3.5 py-2.5 mb-5" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: T.ink3 }}>Filter</span>
          <select style={selectStyle} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="mtd">Month to date</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select style={selectStyle} value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
            <option value="">All channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="web_chat">Web Chat</option>
            <option value="push">Push</option>
          </select>
          <select style={selectStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="live">Live</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
          {(filterChannel || filterStatus || period !== "mtd") && (
            <button onClick={() => { setFilterChannel(""); setFilterStatus(""); setPeriod("mtd"); }} className="text-xs px-3 py-[5px] rounded-md" style={{ border: `1px solid ${T.border}`, color: T.ink1, background: T.surface }}>Clear</button>
          )}
        </div>

        {/* Low balance alert */}
        {isLowBalance && (
          <button onClick={() => navigate("/settings/wallet")} className="w-full flex items-center gap-3 rounded-[10px] px-4 py-3 mb-5 text-left" style={{ background: T.amberBg, border: "1px solid #FDE68A", color: "#92400E" }}>
            <span>⚠</span>
            <span className="text-[13px] flex-1">Wallet balance {inr(wallet?.balance as number)} is below ₹5,000. <span className="underline font-medium">Top up →</span></span>
          </button>
        )}

        {/* Outreach KPIs */}
        <SectionLabel>Outreach — {periodLabel}</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MetricCard accent={T.blue} label="Patients reached" value={nf(patientsReached)} valueColor={T.blue} sub={`${activeCampaigns} active campaign${activeCampaigns !== 1 ? "s" : ""}`} onClick={() => navigate("/marketing/campaigns")} />
          <MetricCard accent={T.green} label="Avg delivery rate" value={`${deliveryRate}%`} valueColor={T.green} delta={`${deliveryRate - BENCHMARKS.delivery >= 0 ? "↑ +" : "↓ "}${deliveryRate - BENCHMARKS.delivery}pp vs industry (${BENCHMARKS.delivery}%)`} deltaTone={deliveryRate >= BENCHMARKS.delivery ? "up" : "down"} progress={{ pct: deliveryRate, color: T.green }} />
          <MetricCard accent={T.purple} label="Conversions" value={nf(totalConversions)} valueColor={T.purple} sub={`${convPct}% of patients reached`} onClick={() => navigate("/marketing/campaigns")} />
          <MetricCard accent="#F59E0B" label="Active campaigns" value={activeCampaigns} sub="Running now" onClick={() => navigate("/marketing/campaigns")} />
        </div>

        {/* ROI */}
        <SectionLabel>Return on investment</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 items-stretch">
          <MetricCard label="Total spend" value={<span className="text-[24px]">{inr(totalSpend, 2)}</span>} sub="Campaign costs + fees + GST" onClick={() => navigate("/settings/wallet")} />
          <MetricCard label="Revenue attributed" value={<span className="text-[24px]">{compactInr(totalRevenue)}</span>} valueColor={T.green} sub="From UHID-matched bookings" delta={`${totalConversions} conversions · ${inr(avgBooking)} avg booking`} deltaTone="up" />
          <div className="rounded-[14px] p-5 flex flex-col" style={{ background: "#1A1A18", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}>
            <div className="text-[11px] font-medium mb-1.5" style={{ color: "#9A9A92" }}>Return on investment</div>
            <div className="text-[28px] font-bold leading-none tracking-tight">{nf(roi)}%</div>
            <div className="text-[11px] mt-1.5" style={{ color: "#9A9A92" }}>Revenue ÷ Spend · {periodLabel}</div>
            <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
              <div className="rounded-md px-2.5 py-2" style={{ background: "rgba(255,255,255,.06)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-0.5" style={{ color: "#7A7A72" }}>Cost / patient</div>
                <div className="text-[15px] font-bold">{inr(costPerPatient, 2)}</div>
              </div>
              <div className="rounded-md px-2.5 py-2" style={{ background: "rgba(255,255,255,.06)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-0.5" style={{ color: "#7A7A72" }}>ROAS</div>
                <div className="text-[15px] font-bold" style={{ color: "#4ADE80" }}>{roas}×</div>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign deep-dive */}
        {fc && (
          <>
            <SectionLabel>Campaign deep-dive — {fc.name}</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <DCard>
                <CardTitle hint="Drop-off at each stage">Delivery funnel</CardTitle>
                <FunnelSVG stages={fcFunnel} />
              </DCard>
              <DCard>
                <CardTitle hint="▎ = industry avg">Rates vs benchmarks</CardTitle>
                <BenchmarkBar label="Delivery rate" value={fcDeliveryRate} benchmark={BENCHMARKS.delivery} color={T.green} />
                <BenchmarkBar label="Open rate" value={fcOpenRate} benchmark={BENCHMARKS.open} color={T.purple} />
                <BenchmarkBar label="Click-through rate" value={fcCtr} benchmark={BENCHMARKS.ctr} color={T.amber} />
                <BenchmarkBar label="Conversion rate" value={fcConvRate} benchmark={BENCHMARKS.conv} color={T.green} />
                <div className="h-px my-3.5" style={{ background: T.border2 }} />
                <div className="text-[10px] font-bold uppercase tracking-[0.07em] mb-2.5" style={{ color: T.ink3 }}>Cost efficiency</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatMini label="Spend" value={<span className="text-[15px]">{inr(fc.spend, 2)}</span>} sub="This campaign" />
                  <StatMini label="Revenue" value={<span className="text-[15px]">{compactInr(fc.revenueAttributed)}</span>} valueColor={T.green} sub={`${fcRoas}× ROAS`} />
                  <StatMini label="Cost/conv." value={<span className="text-[15px]">{fc.converted > 0 ? inr(fc.costPerConversion, 2) : "—"}</span>} sub="Per booking" />
                </div>
              </DCard>
            </div>
          </>
        )}

        {/* All campaigns table */}
        <div className="flex items-baseline justify-between mb-2.5 mt-6">
          <span className="text-[10px] font-bold tracking-[0.09em] uppercase" style={{ color: T.ink3 }}>All campaigns</span>
          <button onClick={() => navigate("/marketing/campaigns")} className="text-[11px] font-medium" style={{ color: T.blue }}>View all →</button>
        </div>
        <DCard className="mb-4 overflow-x-auto !p-0">
          <div className="px-5 pt-5">
            <CardTitle hint="Sorted by last activity">Campaign performance</CardTitle>
          </div>
          <table className="w-full text-[12px]" style={{ minWidth: 920 }}>
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.06em]" style={{ color: T.ink3 }}>
                {["Campaign", "Channel", "Sent", "Delivery", "Open rate", "CTR", "Conversions", "Revenue attr.", "Cost / conv.", "Status"].map((h, i) => (
                  <th key={h} className={`text-left font-semibold py-2 pr-3 whitespace-nowrap ${i === 0 ? "pl-5" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: T.ink3 }}>{recentCampaigns.length === 0 ? "No campaigns in this period" : "No campaigns match filters"}</td></tr>
              ) : filtered.map((c: any) => {
                const st = CAMPAIGN_STATUS[c.status] ?? { tone: "neutral" as BadgeTone, label: c.status };
                const hasData = c.delivered > 0;
                const hasEngagement = c.opened > 0 || c.clicked > 0;
                return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${T.border2}` }} className="cursor-pointer hover:bg-[#FAFAF8]" onClick={() => navigate(`/marketing/metrics?campaign=${c.id}`)}>
                    <td className="py-2.5 pr-3 pl-5">
                      <div className="font-medium" style={{ color: T.ink1 }}>{c.name}</div>
                      <div className="text-[11px]" style={{ color: T.ink3 }}>{c.goal ? `${c.goal} · ` : ""}{STATUS_NOTE[c.status] ?? ""}</div>
                    </td>
                    <td className="py-2.5 pr-3">{c.channel ? <Badge tone={CHANNEL_BADGE[c.channel] ?? "neutral"}>{chLabel(c.channel)}</Badge> : <span style={{ color: T.ink4 }}>—</span>}</td>
                    <td className="py-2.5 pr-3 font-medium" style={{ color: c.sent > 0 ? T.ink1 : T.ink4 }}>{nf(c.sent)}</td>
                    <td className="py-2.5 pr-3">
                      {hasData ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-11 h-1 rounded-sm overflow-hidden" style={{ background: T.surface2 }}>
                            <div className="h-1 rounded-sm" style={{ width: `${c.deliveryRate}%`, background: c.deliveryRate >= 85 ? T.green : T.amber }} />
                          </div>
                          <span className="font-semibold" style={{ color: c.deliveryRate >= 85 ? T.green : T.amber }}>{c.deliveryRate}%</span>
                        </div>
                      ) : <span style={{ color: T.ink4 }}>—</span>}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: hasEngagement ? T.purple : T.ink4 }}>{hasEngagement ? `${c.openRate}%` : "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: hasEngagement ? T.amber : T.ink4 }}>{hasEngagement ? `${c.ctr}%` : "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: c.converted > 0 ? T.green : T.ink4 }}>{c.converted > 0 ? <>{c.converted} <span className="font-normal text-[11px]" style={{ color: T.ink3 }}>({c.convRate}%)</span></> : "—"}</td>
                    <td className="py-2.5 pr-3 font-semibold" style={{ color: c.revenueAttributed > 0 ? T.green : T.ink4 }}>{c.revenueAttributed > 0 ? compactInr(c.revenueAttributed) : "—"}</td>
                    <td className="py-2.5 pr-3" style={{ color: c.converted > 0 ? T.ink1 : T.ink4 }}>{c.converted > 0 ? inr(c.costPerConversion, 2) : "—"}</td>
                    <td className="py-2.5 pr-5"><Badge tone={st.tone}>{st.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DCard>

        {/* Recommended actions */}
        <SectionLabel>Recommended actions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard tone="red" eyebrow="Verify today" title="Audit campaign spend" body={`${inr(totalSpend, 2)} recorded across ${nf(patientsReached)} patients. Confirm channel fees and GST are fully attributed before the next billing cycle.`} />
          <ActionCard tone="amber" eyebrow="This week" title="Improve click-through rate" body={fc ? `Open rate (${fcOpenRate}%) is strong but CTR (${fcCtr}%) shows a drop-off. Test a direct booking link in the message body next time.` : "Test a direct booking link in the message body to lift click-through on your next campaign."} />
          <ActionCard tone="green" eyebrow="Next campaign" title={fc ? `Scale ${fc.name} template` : "Scale your best template"} body={fc ? "This campaign's engagement rates lead the pack. Apply its targeting criteria and message format to the next specialty drive." : "Apply your strongest campaign's targeting and message format to the next specialty drive."} />
        </div>
      </DashPage>
    </AppLayout>
  );
}

function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }
