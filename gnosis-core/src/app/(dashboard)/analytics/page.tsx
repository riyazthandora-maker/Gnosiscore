"use client"

import { useAnalytics } from "@/lib/hooks/use-analytics"
import { OverviewStats, OverviewStatsSkeleton } from "@/components/analytics/overview-stats"
import { ScoreHistoryChart } from "@/components/analytics/score-history-chart"
import { TopicAccuracyChart } from "@/components/analytics/topic-accuracy-chart"
import { DiagnosticReport } from "@/components/analytics/diagnostic-report"
import { AlertCircle } from "lucide-react"

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useAnalytics()

  const hasData = (data?.overview.testsTaken ?? 0) > 0
  // Diagnostic needs at least 3 tests and some topic data to be meaningful
  const hasEnoughForDiagnostic = (data?.overview.testsTaken ?? 0) >= 3 && (data?.topics.length ?? 0) > 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Performance trends and AI diagnostic reports.</p>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          Failed to load analytics data. Please refresh.
        </div>
      )}

      {isLoading ? (
        <OverviewStatsSkeleton />
      ) : hasData ? (
        <>
          <OverviewStats data={data!.overview} />
          <div className="grid gap-6 xl:grid-cols-2">
            <ScoreHistoryChart data={data!.history} />
            <TopicAccuracyChart data={data!.topics} />
          </div>
          <DiagnosticReport hasEnoughData={hasEnoughForDiagnostic} />
        </>
      ) : !isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <p className="font-medium">No data yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Complete your first test to start tracking your performance here.
          </p>
        </div>
      )}
    </div>
  )
}
