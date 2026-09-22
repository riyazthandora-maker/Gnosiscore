"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, BarChart3, ChevronLeft, Users } from "lucide-react"
import { ScoreBadge } from "@/components/shared/score-badge"
import { MilestoneTypeBadge } from "@/components/pacing/milestone-type-badge"
import { cn } from "@/lib/utils"
import type { AnalyticsResponse, MilestoneStat } from "@/app/api/educator/pacing/[planId]/analytics/route"
import type { DifficultyBands } from "@/types"

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function monthLabel(month: number, week: number, startMonth: number, academicYear: string): string {
  const parts = academicYear.split("-")
  const y1 = parseInt(parts[0]), y2 = parseInt(parts[1])
  const year = month >= startMonth ? y1 : y2
  return `W${week} · ${MONTH_SHORT[month - 1]} ${year}`
}

function CompletionBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-muted-foreground/40")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{pct.toFixed(0)}%</span>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold", accent)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

interface Props {
  data:         AnalyticsResponse
  planTitle:    string
  academicYear: string
  gradeName:    string
  planId:       string
}

export function CohortAnalyticsClient({ data, planTitle, academicYear, gradeName, planId }: Props) {
  const { milestones, summary, difficulty_bands: bands, start_month } = data
  const [tab, setTab] = useState<"timeline" | "scores">("timeline")

  const assessMilestones = milestones.filter(m => m.milestone_type === "assess")

  const overallAvgColor =
    summary.overall_avg_score === null ? "" :
    summary.overall_avg_score >= bands.high[0] ? "text-emerald-600 dark:text-emerald-400" :
    summary.overall_avg_score >= bands.low[0]  ? "text-amber-600  dark:text-amber-400"  :
    "text-red-600 dark:text-red-400"

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto w-full">

      {/* Header */}
      <div>
        <Link
          href={`/exams/pacing/${planId}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="size-3.5" /> Back to Plan
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" />
          Cohort Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {planTitle} · {gradeName} · {academicYear}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Milestones"
          value={String(summary.total_milestones)}
          sub={`${summary.assess_count} assess slots`}
        />
        <StatCard
          label="Avg Score"
          value={summary.overall_avg_score !== null ? `${summary.overall_avg_score.toFixed(1)}%` : "—"}
          sub="across assess slots"
          accent={overallAvgColor}
        />
        <StatCard
          label="Completion"
          value={summary.overall_completion_rate !== null ? `${summary.overall_completion_rate.toFixed(0)}%` : "—"}
          sub="students submitted"
        />
        <StatCard
          label="At Risk"
          value={String(summary.at_risk.length)}
          sub={`below ${bands.low[0]}% threshold`}
          accent={summary.at_risk.length > 0 ? "text-red-600 dark:text-red-400" : ""}
        />
      </div>

      {/* At-risk callout */}
      {summary.at_risk.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {summary.at_risk.length} chapter{summary.at_risk.length > 1 ? "s" : ""} below the low-score threshold ({bands.low[0]}%)
            </p>
          </div>
          <ul className="space-y-1">
            {summary.at_risk.map(m => (
              <li key={m.milestone_id} className="flex items-center justify-between text-sm">
                <span className="text-red-800 dark:text-red-300">{m.node_title}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{monthLabel(m.month, m.week_in_month, start_month, academicYear)}</span>
                  <ScoreBadge score={m.avg_score_pct} bands={bands} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border">
        {(["timeline", "scores"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "timeline" ? "Progress Timeline" : "Score Table"}
          </button>
        ))}
      </div>

      {/* Timeline tab */}
      {tab === "timeline" && (
        <div className="flex flex-col gap-2">
          {milestones.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No milestones scheduled yet.</p>
          )}
          {milestones.map(m => (
            <TimelineRow
              key={m.milestone_id}
              m={m}
              bands={bands}
              start_month={start_month}
              academicYear={academicYear}
            />
          ))}
        </div>
      )}

      {/* Score table tab */}
      {tab === "scores" && (
        <div>
          {assessMilestones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No assess milestones yet. Mark slots as "Assess" in the plan to track scores here.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Chapter</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Slot</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Completion</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assessMilestones.map(m => (
                    <ScoreRow key={m.milestone_id} m={m} bands={bands} start_month={start_month} academicYear={academicYear} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

function TimelineRow({ m, bands, start_month, academicYear }: {
  m: MilestoneStat
  bands: DifficultyBands
  start_month: number
  academicYear: string
}) {
  const hasData = m.milestone_type === "assess" && m.total_assigned > 0

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <MilestoneTypeBadge type={m.milestone_type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{m.node_title}</p>
        <p className="text-xs text-muted-foreground">{monthLabel(m.month, m.week_in_month, start_month, academicYear)}</p>
      </div>
      {hasData ? (
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3" />
            {m.completed_count}/{m.total_assigned}
          </div>
          <div className="w-24 hidden sm:block">
            <CompletionBar pct={m.completion_rate_pct} />
          </div>
          <ScoreBadge score={m.avg_score_pct} bands={bands} />
        </div>
      ) : m.milestone_type === "assess" ? (
        <span className="text-xs text-muted-foreground shrink-0">No exam yet</span>
      ) : null}
    </div>
  )
}

function ScoreRow({ m, bands, start_month, academicYear }: {
  m: MilestoneStat
  bands: DifficultyBands
  start_month: number
  academicYear: string
}) {
  const isAtRisk = m.avg_score_pct !== null && m.avg_score_pct < bands.low[0]

  return (
    <tr className={cn("hover:bg-muted/30 transition-colors", isAtRisk && "bg-red-50/50 dark:bg-red-950/20")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isAtRisk && <AlertTriangle className="size-3.5 text-red-500 shrink-0" />}
          <span className="font-medium">{m.node_title}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
        {monthLabel(m.month, m.week_in_month, start_month, academicYear)}
      </td>
      <td className="px-4 py-3">
        {m.total_assigned > 0 ? (
          <div className="flex flex-col gap-1">
            <CompletionBar pct={m.completion_rate_pct} />
            <span className="text-xs text-muted-foreground">{m.completed_count}/{m.total_assigned} students</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No exam assigned</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ScoreBadge score={m.avg_score_pct} bands={bands} />
      </td>
    </tr>
  )
}
