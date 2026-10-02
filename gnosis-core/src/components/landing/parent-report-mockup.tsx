import { TrendingUp, TrendingDown } from "lucide-react"
import type { Copy } from "./landing-copy"

/**
 * Marketing preview of the real weekly parent report.
 * Mirrors src/components/analytics/diagnostic-report.tsx and overview-stats.tsx.
 */
export function ParentReportMockup({ m }: { m: Copy["parents"]["mockup"] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <h3 className="text-sm font-semibold">{m.title}</h3>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {m.sampleNote}
        </span>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] text-muted-foreground">{m.avgScore}</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-bold tabular-nums">78%</p>
              <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 tabular-nums">
                {m.delta}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground/70">{m.since}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] text-muted-foreground">{m.testsTaken}</p>
            <p className="text-xl font-bold tabular-nums">14</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] text-muted-foreground">{m.accuracy}</p>
            <p className="text-xl font-bold tabular-nums">81%</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-green-500" />
            <h4 className="text-xs font-semibold">{m.strengths}</h4>
          </div>
          <div className="space-y-2.5">
            {m.strengthRows.map((s) => (
              <div key={s.topic} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium">{s.topic}</span>
                  <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
                    {s.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-destructive" />
            <h4 className="text-xs font-semibold">{m.focus}</h4>
          </div>
          <div className="space-y-2">
            {m.focusRows.map((w) => (
              <div key={w.topic} className="space-y-1.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{w.topic}</span>
                  <span className="text-[10px] font-bold text-destructive tabular-nums">
                    {w.pct}% {m.errorRate}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{w.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
