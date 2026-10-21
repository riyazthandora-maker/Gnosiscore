"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAnalytics } from "@/lib/hooks/use-analytics"
import { OverviewStats, OverviewStatsSkeleton } from "@/components/analytics/overview-stats"
import { ScoreHistoryChart } from "@/components/analytics/score-history-chart"
import { TopicAccuracyChart } from "@/components/analytics/topic-accuracy-chart"
import { DiagnosticReport } from "@/components/analytics/diagnostic-report"
import { WeaknessCallout } from "@/components/analytics/weakness-callout"
import { Button } from "@/components/ui/button"
import { BarChart3, BrainCircuit, Loader2 } from "lucide-react"

interface TalentReport {
  strengths: Array<{ topic: string; confidence_pct: number }>
  raw_narrative: string | null
}

function TalentInsightPanel({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<TalentReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/analytics/talent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.report) setReport(d.report)
        else setError(d.error ?? "Could not load talent insight.")
      })
      .catch(() => setError("Could not load talent insight."))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Analysing your talent profile…</span>
      </div>
    )
  }

  if (error || !report) return null

  const arts     = report.strengths?.find((s) => s.topic === "Arts")?.confidence_pct ?? 0
  const language = report.strengths?.find((s) => s.topic === "Language")?.confidence_pct ?? 0
  const maths    = report.strengths?.find((s) => s.topic === "Maths")?.confidence_pct ?? 0

  const domains = [
    { label: "Arts",     pct: arts,     color: "bg-rose-500" },
    { label: "Language", pct: language, color: "bg-violet-500" },
    { label: "Maths",    pct: maths,    color: "bg-blue-500" },
  ]

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BrainCircuit className="size-5 text-primary" />
        <h2 className="font-semibold text-base">Your Talent Profile</h2>
      </div>

      {report.raw_narrative && (
        <p className="text-sm text-foreground/80 leading-relaxed">{report.raw_narrative}</p>
      )}

      <div className="space-y-3">
        {domains.map(({ label, pct, color }) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EoiModal({ onAccept, onLater }: { onAccept: () => void; onLater: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
          <BrainCircuit className="size-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Let&apos;s join us to assess your lessons free for 3 months</h2>
        <p className="text-sm text-muted-foreground">
          Get personalised learning plans, structured assessments, and teacher support — completely free for 3 months.
        </p>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={onAccept}>OK, I&apos;m in!</Button>
          <Button variant="outline" className="flex-1" onClick={onLater}>Later</Button>
        </div>
      </div>
    </div>
  )
}

function EoiThankYou() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
          <svg className="size-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Thanks for your interest!</h2>
        <p className="text-sm text-muted-foreground">
          Our admin will contact you soon to get you started on your learning journey.
        </p>
      </div>
    </div>
  )
}

const EOI_DISMISSED_KEY = "eoi_dismissed_until"

export default function StudentProgressPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session")

  const { data, isLoading } = useAnalytics()

  const scoreDelta =
    data && data.history.length >= 2
      ? data.history[data.history.length - 1].score - data.history[0].score
      : undefined

  const hasEnoughData = (data?.overview.testsTaken ?? 0) >= 3

  // EOI modal state
  const [eoiStatus, setEoiStatus] = useState<"idle" | "show" | "accepted" | "dismissed">("idle")
  const [isWalkin, setIsWalkin] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sessionId) return

    // Check walk-in status
    fetch("/api/eoi")
      .then((r) => r.json())
      .then((d) => {
        if (!d.is_walkin || d.eoi_submitted) return
        setIsWalkin(true)

        // Check if user dismissed recently
        const dismissedUntil = localStorage.getItem(EOI_DISMISSED_KEY)
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return

        timerRef.current = setTimeout(() => {
          setEoiStatus("show")
        }, 5000)
      })
      .catch(() => {})

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [sessionId])

  async function handleEoiAccept() {
    setEoiStatus("accepted")
    await fetch("/api/eoi", { method: "POST" }).catch(() => {})
  }

  function handleEoiLater() {
    setEoiStatus("dismissed")
    // Suppress for 24 hours
    localStorage.setItem(EOI_DISMISSED_KEY, String(Date.now() + 24 * 60 * 60 * 1000))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your performance across all completed tests.
        </p>
      </div>

      {sessionId && <TalentInsightPanel sessionId={sessionId} />}

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

      {eoiStatus === "show" && (
        <EoiModal onAccept={handleEoiAccept} onLater={handleEoiLater} />
      )}
      {eoiStatus === "accepted" && <EoiThankYou />}
    </div>
  )
}
