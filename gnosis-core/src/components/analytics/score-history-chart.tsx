"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import type { HistoryPoint } from "@/app/api/analytics/route"

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#22c55e",
  medium: "#3b82f6",
  hard: "#f59e0b",
  advanced: "#ef4444",
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: HistoryPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-md">
      <p className="font-semibold">{p.docTitle}</p>
      <p className="text-muted-foreground capitalize">{p.toughness} · {p.date}</p>
      <p className="mt-1 text-base font-bold" style={{ color: DIFFICULTY_COLOR[p.toughness] ?? "#6366f1" }}>
        {p.score}%
      </p>
    </div>
  )
}

export function ScoreHistoryChart({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Complete at least 2 tests to see your score trend.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-4 text-sm font-semibold">Score history</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="var(--color-border)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              return (
                <circle
                  key={`dot-${payload.attemptId}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={DIFFICULTY_COLOR[payload.toughness] ?? "var(--color-primary)"}
                  stroke="var(--color-background)"
                  strokeWidth={2}
                />
              )
            }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(DIFFICULTY_COLOR).map(([d, c]) => (
          <span key={d} className="flex items-center gap-1 capitalize">
            <span className="inline-block size-2.5 rounded-full" style={{ background: c }} />
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}
