"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronLeft, Loader2, Brain, TrendingUp, TrendingDown,
  Minus, CheckCircle2, AlertCircle, Target,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ExamHistoryEntry {
  attempt_id: string
  test_id: string
  test_title: string
  score: number
  max_score: number
  pct: number
  completed_at: string
  total_attempts: number
}

interface TopicAccuracy {
  topic: string
  correct: number
  total: number
  accuracy_pct: number
}

interface InsightsData {
  student: { id: string; full_name: string; email: string }
  exam_history: ExamHistoryEntry[]
  class_averages: Record<string, number>
  topic_accuracy: TopicAccuracy[]
  score_trend: { test_title: string; pct: number; completed_at: string }[]
  ai_advisory: string | null
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso))
}

function ScoreBar({ pct, classAvg }: { pct: number; classAvg?: number }) {
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-destructive"
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{pct}%</span>
        {classAvg !== undefined && (
          <span className="text-muted-foreground">Class avg: {classAvg}%</span>
        )}
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
        {classAvg !== undefined && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/40"
            style={{ left: `${classAvg}%` }}
          />
        )}
      </div>
    </div>
  )
}

export default function StudentInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params)
  const router = useRouter()

  const { data, isLoading, isError } = useQuery<InsightsData>({
    queryKey: ["student-insights", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/educator/students/${studentId}/insights`)
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading insights…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="font-medium">Failed to load insights</p>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">Go back</button>
      </div>
    )
  }

  const { student, exam_history, class_averages, topic_accuracy, score_trend, ai_advisory } = data
  const avgScore = exam_history.length
    ? Math.round(exam_history.reduce((s, e) => s + e.pct, 0) / exam_history.length)
    : null

  const trendDelta = score_trend.length >= 2
    ? score_trend[score_trend.length - 1].pct - score_trend[0].pct
    : null

  const TrendIcon = trendDelta === null ? Minus
    : trendDelta > 5 ? TrendingUp
    : trendDelta < -5 ? TrendingDown
    : Minus

  const trendColor = trendDelta === null ? "text-muted-foreground"
    : trendDelta > 5 ? "text-green-600 dark:text-green-400"
    : trendDelta < -5 ? "text-destructive"
    : "text-muted-foreground"

  const strengths = topic_accuracy.filter((t) => t.accuracy_pct >= 70)
  const weaknesses = topic_accuracy.filter((t) => t.accuracy_pct < 60)

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight truncate">{student.full_name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-2xl font-bold">{exam_history.length}</p>
          <p className="text-sm font-medium">Exams taken</p>
          <p className="text-xs text-muted-foreground">First attempts recorded</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-2xl font-bold">{avgScore !== null ? `${avgScore}%` : "—"}</p>
          <p className="text-sm font-medium">Average score</p>
          <p className="text-xs text-muted-foreground">Across all first attempts</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">
              {trendDelta !== null ? `${trendDelta > 0 ? "+" : ""}${trendDelta}%` : "—"}
            </p>
            <TrendIcon className={cn("size-5", trendColor)} />
          </div>
          <p className="text-sm font-medium">Score trend</p>
          <p className="text-xs text-muted-foreground">First vs latest exam</p>
        </div>
      </div>

      {/* AI Advisory */}
      {ai_advisory && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            <p className="text-sm font-semibold text-primary">AI Advisory</p>
          </div>
          <p className="text-sm leading-relaxed">{ai_advisory}</p>
        </div>
      )}

      {/* Topic accuracy */}
      {topic_accuracy.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Topic Accuracy</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Strengths */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium">Strong topics</p>
              </div>
              {strengths.length === 0 ? (
                <p className="text-xs text-muted-foreground">Not enough data yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {strengths.slice(0, 6).map((t) => (
                    <div key={t.topic}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs truncate max-w-[60%]">{t.topic}</span>
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 tabular-nums">{t.accuracy_pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${t.accuracy_pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Weaknesses */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-amber-500" />
                <p className="text-sm font-medium">Needs attention</p>
              </div>
              {weaknesses.length === 0 ? (
                <p className="text-xs text-muted-foreground">No weak topics identified.</p>
              ) : (
                <div className="space-y-2.5">
                  {weaknesses.slice(0, 6).map((t) => (
                    <div key={t.topic}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs truncate max-w-[60%]">{t.topic}</span>
                        <span className="text-xs font-medium text-destructive tabular-nums">{t.accuracy_pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-destructive" style={{ width: `${t.accuracy_pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Exam history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exam History</h2>
        {exam_history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No exams completed yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {exam_history.map((e) => (
              <div key={e.attempt_id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.test_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.completed_at)}
                      {e.total_attempts > 1 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          · {e.total_attempts} attempts total
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                    e.pct >= 80 ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : e.pct >= 60 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "bg-destructive/10 text-destructive"
                  )}>
                    {e.score}/{e.max_score} ({e.pct}%)
                  </span>
                </div>
                <ScoreBar pct={e.pct} classAvg={class_averages[e.test_id]} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
