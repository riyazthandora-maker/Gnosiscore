"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { TopicStat } from "@/app/api/analytics/route"

function barColor(pct: number) {
  if (pct >= 80) return "#22c55e"
  if (pct >= 60) return "#f59e0b"
  return "#ef4444"
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopicStat }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-md">
      <p className="font-semibold">{d.topic}</p>
      <p className="text-muted-foreground">{d.correct} / {d.total} correct</p>
      <p className="mt-1 text-base font-bold" style={{ color: barColor(d.accuracyPct) }}>
        {d.accuracyPct}%
      </p>
    </div>
  )
}

export function TopicAccuracyChart({ data }: { data: TopicStat[] }) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No topic data yet. Complete a test to see a breakdown.
      </div>
    )
  }

  // Sort by accuracy ascending so weakest topics appear at top of horizontal bar
  const sorted = [...data].sort((a, b) => a.accuracyPct - b.accuracyPct).slice(0, 12)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-4 text-sm font-semibold">Topic accuracy</p>
      <ResponsiveContainer width="100%" height={Math.max(sorted.length * 36, 160)}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="topic"
            width={130}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="accuracyPct" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {sorted.map((entry) => (
              <Cell key={entry.topic} fill={barColor(entry.accuracyPct)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {[["#22c55e", "≥80% strong"], ["#f59e0b", "60-79% ok"], ["#ef4444", "<60% review"]].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
