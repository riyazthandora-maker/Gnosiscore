"use client"

import type { Metadata } from "next"
import { useAnalytics } from "@/lib/hooks/use-analytics"
import { OverviewStats, OverviewStatsSkeleton } from "@/components/analytics/overview-stats"
import { ScoreHistoryChart } from "@/components/analytics/score-history-chart"
import { TopicAccuracyChart } from "@/components/analytics/topic-accuracy-chart"
import { DiagnosticReport } from "@/components/analytics/diagnostic-report"
import { WeaknessCallout } from "@/components/analytics/weakness-callout"
import { BarChart3 } from "lucide-react"

export default function StudentProgressPage() {
  const { data, isLoading } = useAnalytics()

  const scoreDelta =
    data && data.history.length >= 2
      ? data.history[data.history.length - 1].score - data.history[0].score
      : undefined

  const hasEnoughData = (data?.overview.testsTaken ?? 0) >= 3

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your performance across all completed tests.
        </p>
      </div>

      {isLoading ? (
        <OverviewStatsSkeleton />
      ) : !data || data.overview.testsTaken === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <BarChart3 className="size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No results yet</p>
          <p className="text-xs text-muted-foreground/60">
            Complete a test to see your progress and analytics.
          </p>
        </div>
      ) : (
        <>
          <OverviewStats data={data.overview} scoreDelta={scoreDelta} />
          {data.topics.length > 0 && <WeaknessCallout topics={data.topics} />}
          <div className="grid gap-6 xl:grid-cols-2">
            <ScoreHistoryChart data={data.history} />
            <TopicAccuracyChart data={data.topics} />
          </div>
          <DiagnosticReport hasEnoughData={hasEnoughData} />
        </>
      )}
    </div>
  )
}
