"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import { OverviewStats, OverviewStatsSkeleton } from "@/components/analytics/overview-stats"
import { ScoreHistoryChart } from "@/components/analytics/score-history-chart"
import { TopicAccuracyChart } from "@/components/analytics/topic-accuracy-chart"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { AnalyticsPayload } from "@/app/api/analytics/route"

interface SharedPayload extends AnalyticsPayload {
  ownerName: string
}

export default function SharedDashboardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)

  const { data, isLoading, isError } = useQuery<SharedPayload>({
    queryKey: ["shared-analytics", userId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/shared/${userId}`)
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }
      return res.json()
    },
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {data?.ownerName ? `${data.ownerName}'s Dashboard` : "Shared Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">Read-only view</p>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Access denied or dashboard no longer shared with you.
        </div>
      )}

      {isLoading ? (
        <OverviewStatsSkeleton />
      ) : data && data.overview.testsTaken > 0 ? (
        <>
          <OverviewStats data={data.overview} />
          <div className="grid gap-6 xl:grid-cols-2">
            <ScoreHistoryChart data={data.history} />
            <TopicAccuracyChart data={data.topics} />
          </div>
        </>
      ) : data ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          This user hasn't completed any tests yet.
        </div>
      ) : null}
    </div>
  )
}
