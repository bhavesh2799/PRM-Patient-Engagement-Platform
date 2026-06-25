import { AppLayout } from "@/components/layout/AppLayout";
import { useListCampaigns, useGetCampaignMetrics, useGetWallet } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import {
  T, DashPage, PageHead, DCard, CardTitle, SectionLabel, MetricCard,
  StatMini, BenchmarkBar, ActionCard, FunnelSVG, Badge, BadgeTone,
  nf, inr, compactInr, type FunnelStage,
} from "@/components/dashboard/ui";

const BENCHMARKS = { delivery: 82, open: 40, ctr: 18, conv: 5 };

const STATUS_TONE: Record<string, BadgeTone> = {
  live: "ok", completed: "neutral", paused: "warn",
  submitted: "info", approved: "ok", draft: "neutral", failed: "danger",
};

export default function Metrics() {
  const search = useSearch();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: campaigns } = useListCampaigns();
  const { data: wallet } = useGetWallet();
  const { data: metrics, isLoading } = useGetCampaignMetrics(selectedId as number, {
    query: { enabled: !!selectedId, queryKey: ["getCampaignMetrics", selectedId] },
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get("campaign");
    if (id) setSelectedId(Number(id));
  }, [search]);

  const selectedCampaign = campaigns?.find(c => c.id === selectedId);
  const balance = wallet ? parseFloat(String(wallet.balance)) : undefined;
  const isLowBalance = balance !== undefined && balance < 5000;

  const sent = metrics?.sent ?? 0;
  const delivered = metrics?.delivered ?? 0;
  const opened = metrics?.opened ?? 0;
  const clicked = metrics?.clicked ?? 0;
  const converted = metrics?.converted ?? 0;
  const spend = metrics?.spend ?? 0;
  const revenue = metrics?.revenueAttributed ?? 0;

  const deliveryRate = sent ? Math.round((delivered / sent) * 1000) / 10 : 0;
  const openRate = delivered ? Math.round((opened / delivered) * 1000) / 10 : 0;
  const ctr = delivered ? Math.round((clicked / delivered) * 1000) / 10 : 0;
  const convRate = sent ? Math.round((converted / sent) * 1000) / 10 : 0;
  const roas = spend > 0 ? Math.round((revenue / spend) * 10) / 10 : 0;
  const costPerConversion = converted > 0 ? spend / converted : null;

  const funnel: FunnelStage[] = [
    { label: "Sent", count: sent, sub: "100%", color: T.blue, fill: "rgba(37,99,235,.9)" },
    { label: "Delivered", count: delivered, sub: `${pct(delivered, sent)}%`, color: T.blue, fill: "rgba(37,99,235,.55)" },
    { label: "Opened", count: opened, sub: `${pct(opened, sent)}%`, color: T.purple, fill: "rgba(124,58,237,.85)" },
    { label: "Clicked", count: clicked, sub: `${pct(clicked, sent)}%`, color: T.amber, fill: "rgba(245,158,11,.9)" },
    { label: "Converted", count: converted, sub: `${pct(converted, sent)}%`, color: T.green, fill: "rgba(26,148,104,.9)" },
  ];

  const selectStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 500, color: T.ink1, background: T.surface,
    border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 260, cursor: "pointer",
  };

  return (
    <AppLayout>
      <DashPage>
        <PageHead
          title="Campaign Metrics"
          subtitle="Funnel analysis, benchmarks & cost efficiency per campaign"
          right={
            <select style={selectStyle} value={selectedId || ""} onChange={e => setSelectedId(Number(e.target.value))}>
              <option value="" disabled>Select a campaign…</option>
              {campaigns?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
            </select>
          }
        />

        {isLowBalance && (
          <div className="flex items-center gap-3 rounded-[10px] px-4 py-3 mb-5" style={{ background: T.amberBg, border: "1px solid #FDE68A", color: "#92400E" }}>
            <span>⚠</span>
            <span className="text-[13px]">Wallet balance {inr(balance)} is below ₹5,000. Top up to avoid campaign interruptions.</span>
          </div>
        )}

        {!selectedId ? (
          <DCard>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-[15px] font-semibold mb-1" style={{ color: T.ink1 }}>Select a campaign to analyse</div>
              <div className="text-[13px]" style={{ color: T.ink3 }}>Delivery, engagement, and cost metrics will appear here.</div>
            </div>
          </DCard>
        ) : isLoading ? (
          <DCard><div className="py-20 text-center text-sm" style={{ color: T.ink3 }}>Loading metrics…</div></DCard>
        ) : metrics ? (
          <>
            {selectedCampaign && (
              <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                <h2 className="text-[16px] font-semibold" style={{ color: T.ink1 }}>{selectedCampaign.name}</h2>
                <Badge tone={STATUS_TONE[selectedCampaign.status] ?? "neutral"}>{selectedCampaign.status}</Badge>
                {selectedCampaign.goal && <Badge tone="neutral">{selectedCampaign.goal}</Badge>}
              </div>
            )}

            {/* Headline KPIs */}
            <SectionLabel>Outreach</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <MetricCard accent={T.blue} label="Patients reached" value={nf(sent)} valueColor={T.blue} sub="Total sent" />
              <MetricCard accent={T.green} label="Delivery rate" value={`${deliveryRate}%`} valueColor={T.green} delta={`${deliveryRate - BENCHMARKS.delivery >= 0 ? "↑ +" : "↓ "}${(deliveryRate - BENCHMARKS.delivery).toFixed(0)}pp vs industry (${BENCHMARKS.delivery}%)`} deltaTone={deliveryRate >= BENCHMARKS.delivery ? "up" : "down"} progress={{ pct: deliveryRate, color: T.green }} />
              <MetricCard accent={T.purple} label="Conversions" value={nf(converted)} valueColor={T.purple} sub={`${convRate}% of sent`} />
              <MetricCard accent="#F59E0B" label="Revenue attributed" value={compactInr(revenue)} valueColor={T.green} sub={`${roas}× ROAS`} />
            </div>

            {/* Funnel + benchmarks */}
            <SectionLabel>Funnel &amp; benchmarks</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <DCard>
                <CardTitle hint="Drop-off at each stage">Delivery funnel</CardTitle>
                <FunnelSVG stages={funnel} />
              </DCard>
              <DCard>
                <CardTitle hint="▎ = industry avg">Rates vs benchmarks</CardTitle>
                <BenchmarkBar label="Delivery rate" value={deliveryRate} benchmark={BENCHMARKS.delivery} color={T.green} />
                <BenchmarkBar label="Open rate" value={openRate} benchmark={BENCHMARKS.open} color={T.purple} />
                <BenchmarkBar label="Click-through rate" value={ctr} benchmark={BENCHMARKS.ctr} color={T.amber} />
                <BenchmarkBar label="Conversion rate" value={convRate} benchmark={BENCHMARKS.conv} color={T.green} />
                <div className="h-px my-3.5" style={{ background: T.border2 }} />
                <div className="text-[10px] font-bold uppercase tracking-[0.07em] mb-2.5" style={{ color: T.ink3 }}>Cost efficiency</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatMini label="Spend" value={<span className="text-[15px]">{inr(spend, 2)}</span>} sub="This campaign" />
                  <StatMini label="Revenue" value={<span className="text-[15px]">{compactInr(revenue)}</span>} valueColor={T.green} sub={`${roas}× ROAS`} />
                  <StatMini label="Cost/conv." value={<span className="text-[15px]">{costPerConversion !== null ? inr(costPerConversion, 2) : "—"}</span>} sub="Per booking" />
                </div>
              </DCard>
            </div>

            {/* Recommended actions */}
            <SectionLabel>Recommended actions</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionCard
                tone={deliveryRate >= BENCHMARKS.delivery ? "green" : "red"}
                eyebrow={deliveryRate >= BENCHMARKS.delivery ? "On track" : "Verify today"}
                title={deliveryRate >= BENCHMARKS.delivery ? "Delivery is healthy" : "Investigate delivery drop-off"}
                body={deliveryRate >= BENCHMARKS.delivery ? `Delivery rate of ${deliveryRate}% beats the ${BENCHMARKS.delivery}% benchmark. Keep sender reputation and template quality high.` : `Delivery rate of ${deliveryRate}% trails the ${BENCHMARKS.delivery}% benchmark. Check DLT registration, number quality and opt-in scrub.`}
              />
              <ActionCard
                tone={ctr >= BENCHMARKS.ctr ? "green" : "amber"}
                eyebrow="This week"
                title={ctr >= BENCHMARKS.ctr ? "Strong click-through" : "Improve click-through rate"}
                body={ctr >= BENCHMARKS.ctr ? `CTR of ${ctr}% exceeds benchmark. Replicate this message structure on the next campaign.` : `Open rate (${openRate}%) vs CTR (${ctr}%) shows a drop-off. Test a direct booking link in the message body.`}
              />
              <ActionCard
                tone="green"
                eyebrow="Next campaign"
                title={convRate >= BENCHMARKS.conv ? "Scale this template" : "Tighten audience targeting"}
                body={convRate >= BENCHMARKS.conv ? `Conversion rate of ${convRate}% beats benchmark. Apply this targeting and format to the next specialty drive.` : `Conversion rate of ${convRate}% is below the ${BENCHMARKS.conv}% benchmark. Refine the segment so the message reaches higher-intent patients.`}
              />
            </div>
          </>
        ) : (
          <DCard><div className="py-12 text-center text-sm" style={{ color: T.ink3 }}>No metrics available yet for this campaign.</div></DCard>
        )}
      </DashPage>
    </AppLayout>
  );
}

function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }
