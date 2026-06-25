import { ReactNode } from "react";

/* ── Warm palette (from reference mockups) ─────────────────────── */
export const T = {
  bg: "#F7F6F3",
  surface: "#FFFFFF",
  surface2: "#F2F1EE",
  border: "#E8E6E0",
  border2: "#F0EEE8",
  ink1: "#111110",
  ink2: "#555550",
  ink3: "#99998F",
  ink4: "#BEBEB5",
  green: "#1A9468",
  greenBg: "#EDFAF4",
  red: "#D83B3B",
  redBg: "#FEF2F2",
  amber: "#B45309",
  amberBg: "#FFFBEB",
  blue: "#2563EB",
  blueBg: "#EFF6FF",
  purple: "#7C3AED",
  purpleBg: "#F5F3FF",
} as const;

/* ── Formatters ────────────────────────────────────────────────── */
export const nf = (n: number) => (n ?? 0).toLocaleString("en-IN");
export function inr(n: number, dp = 0): string {
  return `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}
export function compactInr(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${nf(n)}`;
}
export function durationFromMinutes(mins: number | null | undefined): string {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ── Page shell: warm canvas that bleeds over AppLayout padding ─── */
export function DashPage({ children }: { children: ReactNode }) {
  return (
    <div className="-m-6 p-6 md:p-8 min-h-full" style={{ background: T.bg }}>
      <div className="max-w-[1180px] mx-auto">{children}</div>
    </div>
  );
}

export function PageHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight leading-tight" style={{ color: T.ink1 }}>{title}</h1>
        {subtitle && <p className="text-[13px] mt-1" style={{ color: T.ink3 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-2.5 mt-6">
      <span className="text-[10px] font-bold tracking-[0.09em] uppercase" style={{ color: T.ink3 }}>{children}</span>
      {action}
    </div>
  );
}

/* ── Cards ─────────────────────────────────────────────────────── */
export function DCard({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-[14px] p-5 ${className}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)", ...style }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <span className="text-[13px] font-semibold" style={{ color: T.ink1 }}>{children}</span>
      {hint && <span className="text-[11px] font-normal" style={{ color: T.ink3 }}>{hint}</span>}
    </div>
  );
}

/* ── Metric / pulse card ───────────────────────────────────────── */
export function MetricCard({
  label, value, valueColor, sub, delta, deltaTone, accent, progress, onClick,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  sub?: ReactNode;
  delta?: ReactNode;
  deltaTone?: "up" | "down" | "warn";
  accent?: string;
  progress?: { pct: number; color: string };
  onClick?: () => void;
}) {
  const dtColor = deltaTone === "up" ? T.green : deltaTone === "down" ? T.red : deltaTone === "warn" ? T.amber : T.ink3;
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`relative overflow-hidden rounded-[10px] px-[18px] py-4 ${onClick ? "cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1" : ""}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)" }}
    >
      {accent && <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accent }} />}
      <div className="text-[11px] font-medium mb-1.5" style={{ color: T.ink3 }}>{label}</div>
      <div className="text-[26px] font-bold leading-none tracking-tight mb-1.5" style={{ color: valueColor ?? T.ink1 }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: T.ink3 }}>{sub}</div>}
      {delta && <div className="text-[11px] mt-1 font-medium" style={{ color: dtColor }}>{delta}</div>}
      {progress && (
        <div className="h-[3px] rounded-sm mt-2 overflow-hidden" style={{ background: T.surface2 }}>
          <div className="h-[3px] rounded-sm" style={{ width: `${Math.min(100, progress.pct)}%`, background: progress.color }} />
        </div>
      )}
    </div>
  );
}

/* ── Insight strip ─────────────────────────────────────────────── */
export function InsightStrip({ tone = "amber", children }: { tone?: "amber" | "green" | "red"; children: ReactNode }) {
  const c = tone === "green" ? T.green : tone === "red" ? T.red : T.amber;
  return (
    <div
      className="rounded-r-md px-3 py-2.5 text-[11px] mt-3.5 leading-relaxed"
      style={{ background: T.surface2, borderLeft: `2px solid ${c}`, color: T.ink2 }}
    >
      {children}
    </div>
  );
}

/* ── Action card ───────────────────────────────────────────────── */
export function ActionCard({ tone, eyebrow, title, body }: { tone: "red" | "amber" | "green"; eyebrow: string; title: string; body: string }) {
  const c = tone === "red" ? T.red : tone === "amber" ? "#F59E0B" : T.green;
  const dot = tone === "red" ? "🔴" : tone === "amber" ? "🟡" : "🟢";
  return (
    <DCard className="!rounded-[14px]" style={{ borderTop: `2px solid ${c}` }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.07em] mb-1.5 flex items-center gap-1.5" style={{ color: c }}>
        <span>{dot}</span>{eyebrow}
      </div>
      <div className="text-[13px] font-semibold mb-1" style={{ color: T.ink1 }}>{title}</div>
      <div className="text-[12px] leading-relaxed" style={{ color: T.ink2 }}>{body}</div>
    </DCard>
  );
}

/* ── Stat mini ─────────────────────────────────────────────────── */
export function StatMini({ label, value, sub, valueColor }: { label: string; value: ReactNode; sub?: ReactNode; valueColor?: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: T.surface2 }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.05em] mb-1" style={{ color: T.ink3 }}>{label}</div>
      <div className="text-[19px] font-bold tracking-tight" style={{ color: valueColor ?? T.ink1 }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: T.ink3 }}>{sub}</div>}
    </div>
  );
}

/* ── Bar row (channel volume / ageing) ─────────────────────────── */
export function BarRow({ label, pct, color, value, badge, labelWidth = 78 }: { label: string; pct: number; color: string; value: ReactNode; badge?: ReactNode; labelWidth?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="text-[12px] text-right shrink-0" style={{ color: T.ink2, width: labelWidth }}>{label}</div>
      <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: T.surface2 }}>
        <div className="h-2 rounded" style={{ width: `${Math.min(100, Math.max(pct, 2))}%`, background: color }} />
      </div>
      <div className="text-[12px] font-medium text-right shrink-0" style={{ color: T.ink1, width: 56 }}>{value}</div>
      {badge !== undefined && <div className="shrink-0" style={{ width: 56 }}>{badge}</div>}
    </div>
  );
}

/* ── Benchmark bar (value vs industry marker) ──────────────────── */
export function BenchmarkBar({ label, value, benchmark, color, max = 100 }: { label: string; value: number; benchmark: number; color: string; max?: number }) {
  const diff = value - benchmark;
  const diffColor = diff >= 0 ? T.green : T.red;
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="text-[12px] shrink-0" style={{ color: T.ink2, width: 120 }}>{label}</div>
      <div className="flex-1 h-2 rounded relative" style={{ background: T.surface2 }}>
        <div className="h-2 rounded" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
        <div className="absolute -top-1 w-0.5 h-4 rounded-sm" style={{ left: `${Math.min(100, (benchmark / max) * 100)}%`, background: T.ink3 }} title={`Industry: ${benchmark}%`} />
      </div>
      <div className="text-[12px] font-semibold text-right shrink-0" style={{ color: T.ink1, width: 40 }}>{value}%</div>
      <div className="text-[11px] font-medium text-right shrink-0" style={{ color: diffColor, width: 46 }}>
        {diff >= 0 ? "+" : ""}{diff.toFixed(0)}
      </div>
    </div>
  );
}

/* ── Badge ─────────────────────────────────────────────────────── */
export type BadgeTone = "ok" | "warn" | "danger" | "info" | "neutral" | "purple";
const BADGE_STYLES: Record<BadgeTone, { bg: string; color: string }> = {
  ok: { bg: T.greenBg, color: T.green },
  warn: { bg: T.amberBg, color: "#92400E" },
  danger: { bg: T.redBg, color: "#991B1B" },
  info: { bg: T.blueBg, color: "#1E40AF" },
  neutral: { bg: T.surface2, color: T.ink2 },
  purple: { bg: T.purpleBg, color: T.purple },
};
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const s = BADGE_STYLES[tone];
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-[3px] rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
      {children}
    </span>
  );
}

/* ── Avatar (initials) ─────────────────────────────────────────── */
const AVATAR_PALETTE: { bg: string; color: string }[] = [
  { bg: T.redBg, color: "#991B1B" },
  { bg: T.blueBg, color: "#1E40AF" },
  { bg: T.amberBg, color: "#92400E" },
  { bg: T.greenBg, color: "#166534" },
  { bg: T.purpleBg, color: T.purple },
];
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  const initials = name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const p = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  return (
    <div className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-semibold shrink-0" style={{ background: p.bg, color: p.color }}>
      {initials}
    </div>
  );
}

/* ── Funnel (generic N-stage, shared baseline SVG) ─────────────── */
export interface FunnelStage {
  label: string;
  count: number;
  sub?: string;
  color: string;
  fill: string;
}
export function FunnelSVG({ stages }: { stages: FunnelStage[] }) {
  const n = stages.length;
  const W = 460, H = 178, baseY = 118, maxH = 92;
  const slot = W / n;
  const gap = 30;
  const barW = slot - gap;
  const max = Math.max(...stages.map(s => s.count), 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      {stages.map((s, i) => {
        const cx = slot * (i + 0.5);
        const h = Math.max((s.count / max) * maxH, 6);
        const y = baseY - h;
        const x = cx - barW / 2;
        return (
          <g key={i}>
            {i > 0 && (
              <text x={cx - slot / 2} y={baseY - maxH / 2} textAnchor="middle" fontSize="18" fill={T.ink4}>›</text>
            )}
            <rect x={x} y={y} width={barW} height={h} rx={7} fill={s.fill} />
            <text x={cx} y={y - 8} textAnchor="middle" fontSize="20" fontWeight="700" fill={s.color}>{nf(s.count)}</text>
            <text x={cx} y={baseY + 18} textAnchor="middle" fontSize="11" fontWeight="600" fill={s.color}>{s.label}</text>
            {s.sub && <text x={cx} y={baseY + 34} textAnchor="middle" fontSize="10" fill={T.ink3}>{s.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}
