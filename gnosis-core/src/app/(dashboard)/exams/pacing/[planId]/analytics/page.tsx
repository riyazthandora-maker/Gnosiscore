import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CohortAnalyticsClient } from "@/components/pacing/cohort-analytics-client"
import type { AnalyticsResponse, MilestoneStat } from "@/app/api/educator/pacing/[planId]/analytics/route"
import type { DifficultyBands, MilestoneType } from "@/types"

export const metadata: Metadata = { title: "Cohort Analytics" }

export default async function PacingAnalyticsPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: plan } = await supabase
    .from("pacing_plans")
    .select("id, title, academic_year, start_month, difficulty_bands, student_grades(name)")
    .eq("id", planId)
    .eq("teacher_id", user!.id)
    .single()

  if (!plan) notFound()

  const gradeData    = plan.student_grades as unknown as { name: string } | null
  const defaultBands: DifficultyBands = { low: [60, 70], medium: [70, 80], high: [80, 100] }
  const bands        = (plan.difficulty_bands as DifficultyBands) ?? defaultBands
  const startMonth   = plan.start_month as number

  // Fetch milestones
  const { data: milestones } = await supabase
    .from("pacing_milestones")
    .select("id, node_title, milestone_type, month, week_in_month, auto_exam_paper_id")
    .eq("plan_id", planId)

  const sorted = [...(milestones ?? [])].sort((a, b) => {
    const ai = ((a.month - startMonth + 12) % 12) * 4 + a.week_in_month
    const bi = ((b.month - startMonth + 12) % 12) * 4 + b.week_in_month
    return ai - bi
  })

  // Fetch assignment + session data for assess milestones
  const assessPaperIds = sorted
    .filter(m => m.milestone_type === "assess" && m.auto_exam_paper_id)
    .map(m => m.auto_exam_paper_id as string)

  const paperStats: Record<string, { total: number; completed: number; scores: number[] }> = {}

  if (assessPaperIds.length > 0) {
    const { data: assignments } = await supabase
      .from("exam_assignments")
      .select("id, paper_id, student_roster_id, exam_sessions(status, score, max_score)")
      .in("paper_id", assessPaperIds)

    for (const asgn of assignments ?? []) {
      const pid = asgn.paper_id as string
      if (!paperStats[pid]) paperStats[pid] = { total: 0, completed: 0, scores: [] }
      paperStats[pid].total += 1
      const sessions = (asgn.exam_sessions ?? []) as { status: string; score: number | null; max_score: number | null }[]
      const done = sessions.find(s => s.status === "submitted" || s.status === "auto_submitted")
      if (done) {
        paperStats[pid].completed += 1
        if (done.score !== null && done.max_score && done.max_score > 0) {
          paperStats[pid].scores.push((done.score / done.max_score) * 100)
        }
      }
    }
  }

  const stats: MilestoneStat[] = sorted.map(m => {
    const ps  = m.auto_exam_paper_id ? (paperStats[m.auto_exam_paper_id] ?? null) : null
    const tot = ps?.total ?? 0
    const cmp = ps?.completed ?? 0
    const scr = ps?.scores ?? []
    return {
      milestone_id:        m.id as string,
      node_title:          m.node_title as string,
      milestone_type:      (m.milestone_type ?? "teach") as MilestoneType,
      month:               m.month as number,
      week_in_month:       m.week_in_month as number,
      total_assigned:      tot,
      completed_count:     cmp,
      completion_rate_pct: tot > 0 ? Math.round((cmp / tot) * 1000) / 10 : 0,
      avg_score_pct:       scr.length > 0
        ? Math.round((scr.reduce((s, v) => s + v, 0) / scr.length) * 10) / 10
        : null,
    }
  })

  const assessStats   = stats.filter(s => s.milestone_type === "assess")
  const scoredStats   = assessStats.filter(s => s.avg_score_pct !== null)
  const overallAvg    = scoredStats.length > 0
    ? Math.round(scoredStats.reduce((s, m) => s + m.avg_score_pct!, 0) / scoredStats.length * 10) / 10
    : null
  const assignedStats = assessStats.filter(s => s.total_assigned > 0)
  const overallComp   = assignedStats.length > 0
    ? Math.round(assignedStats.reduce((s, m) => s + m.completion_rate_pct, 0) / assignedStats.length * 10) / 10
    : null

  const analyticsData: AnalyticsResponse = {
    plan_id:          planId,
    start_month:      startMonth,
    difficulty_bands: bands,
    milestones:       stats,
    summary: {
      total_milestones:        stats.length,
      assess_count:            assessStats.length,
      overall_avg_score:       overallAvg,
      overall_completion_rate: overallComp,
      at_risk:                 scoredStats.filter(s => s.avg_score_pct! < bands.low[0]),
    },
  }

  return (
    <CohortAnalyticsClient
      data={analyticsData}
      planTitle={plan.title as string}
      academicYear={plan.academic_year as string}
      gradeName={gradeData?.name ?? "—"}
      planId={planId}
    />
  )
}
