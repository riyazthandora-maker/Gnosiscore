"use client"

import { AlertTriangle } from "lucide-react"
import type { TopicStat } from "@/app/api/analytics/route"

export function WeaknessCallout({ topics }: { topics: TopicStat[] }) {
  const weak = [...topics]
    .filter((t) => t.accuracyPct < 60)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 3)

  if (!weak.length) return null

  return (
    <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-destructive">Needs attention</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {weak.map((t) => (
            <span
              key={t.topic}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-background px-3 py-1 text-xs font-medium"
            >
              <span className="font-bold text-destructive">{t.accuracyPct}%</span>
              <span className="max-w-[140px] truncate text-foreground">{t.topic}</span>
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {weak.length === 1 ? "This topic scored" : "These topics scored"} below 60% — focus your revision here.
        </p>
      </div>
    </div>
  )
}
