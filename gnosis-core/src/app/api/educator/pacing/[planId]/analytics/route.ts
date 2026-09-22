import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { DifficultyBands, MilestoneType } from "@/types"

export interface MilestoneStat {
  milestone_id:        string
  node_title:          string
  milestone_type:      MilestoneType
  month:               number
  week_in_month:       number
  total_assigned:      number
  completed_count:     number
  completion_rate_pct: number
  avg_score_pct:       number | null
}

export interface AnalyticsResponse {
  plan_id:         string
  start_month:     number
  difficulty_bands: DifficultyBands
  milestones:      MilestoneStat[]
  summary: {
    total_milestones:        number
    assess_count:            number
    overall_avg_score:       number | null
    overall_completion_rate: number | null
    at_risk:                 MilestoneStat[]
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify educator owns this plan and get config
  const { data: plan, error: planErr } = await supabase
    .from("pacing_plans")
    .select("id, start_month, difficulty_bands")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()

  if (planErr || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  }

  const defaultBands: DifficultyBands = { low: [60, 70], medium: [70, 80], high: [80, 100] }
  const bands = (plan.difficulty_bands as DifficultyBands) ?? defaultBands

  // Fetch all milestones for the plan
  const { data: milestones, error: msErr } = await supabase
    .from("pacing_milestones")
    .select("id, node_title, milestone_type, month, week_in_month, auto_exam_paper_id")
    .eq("plan_id", planId)
    .order("month")
    .order("week_in_month")

  if (msErr) {
    console.error("[pacing analytics] milestones fetch:", msErr.message)
    return NextResponse.json({ error: msErr.message }, { status: 500 })
  }

  // Gather paper_ids for assess milestones
  const assessPaperIds = (milestones ?? [])
    .filter(m => m.milestone_type === "assess" && m.auto_exam_paper_id)
    .map(m => m.auto_exam_paper_id as string)

  // Build per-paper aggregation map from assignments + sessions
  const paperStats: Record<string, { total_assigned: number; completed_count: number; scores: number[] }> = {}

  if (assessPaperIds.length > 0) {
    const { data: assignments } = await supabase
      .from("exam_assignments")
      .select("id, paper_id, student_roster_id, exam_sessions(status, score, max_score)")
      .in("paper_id", assessPaperIds)

    for (const asgn of assignments ?? []) {
      const pid = asgn.paper_id as string
      if (!paperStats[pid]) paperStats[pid] = { total_assigned: 0, completed_count: 0, scores: [] }
      paperStats[pid].total_assigned += 1

      const sessions = (asgn.exam_sessions ?? []) as { status: string; score: number | null; max_score: number | null }[]
      const completedSession = sessions.find(s => s.status === "submitted" || s.status === "auto_submitted")
      if (completedSession) {
        paperStats[pid].completed_count += 1
        if (completedSession.score !== null && completedSession.max_score && completedSession.max_score > 0) {
          paperStats[pid].scores.push((completedSession.score / completedSession.max_score) * 100)
        }
      }
    }
  }

  // Build response milestones sorted by academic year order
  const startMonth = plan.start_month as number
  const sorted = [...(milestones ?? [])].sort((a, b) => {
    const ai = ((a.month - startMonth + 12) % 12) * 4 + a.week_in_month
    const bi = ((b.month - startMonth + 12) % 12) * 4 + b.week_in_month
    return ai - bi
  })

  const stats: MilestoneStat[] = sorted.map(m => {
    const ps = m.auto_exam_paper_id ? (paperStats[m.auto_exam_paper_id] ?? null) : null
    const total_assigned      = ps?.total_assigned ?? 0
    const completed_count     = ps?.completed_count ?? 0
    const completion_rate_pct = total_assigned > 0 ? Math.round((completed_count / total_assigned) * 1000) / 10 : 0
    const scores              = ps?.scores ?? []
    const avg_score_pct       = scores.length > 0
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
      : null

    return {
      milestone_id:        m.id as string,
      node_title:          m.node_title as string,
      milestone_type:      (m.milestone_type ?? "teach") as MilestoneType,
      month:               m.month as number,
      week_in_month:       m.week_in_month as number,
      total_assigned,
      completed_count,
      completion_rate_pct,
      avg_score_pct,
    }
  })

  // Summary
  const assessStats   = stats.filter(s => s.milestone_type === "assess")
  const scoredStats   = assessStats.filter(s => s.avg_score_pct !== null)
  const overallAvg    = scoredStats.length > 0
    ? Math.round(scoredStats.reduce((s, m) => s + m.avg_score_pct!, 0) / scoredStats.length * 10) / 10
    : null
  const assignedStats = assessStats.filter(s => s.total_assigned > 0)
  const overallCompletion = assignedStats.length > 0
    ? Math.round(assignedStats.reduce((s, m) => s + m.completion_rate_pct, 0) / assignedStats.length * 10) / 10
    : null
  const atRisk = scoredStats.filter(s => s.avg_score_pct! < bands.low[0])

  const response: AnalyticsResponse = {
    plan_id:          planId,
    start_month:      startMonth,
    difficulty_bands: bands,
    milestones:       stats,
    summary: {
      total_milestones:        stats.length,
      assess_count:            assessStats.length,
      overall_avg_score:       overallAvg,
      overall_completion_rate: overallCompletion,
      at_risk:                 atRisk,
    },
  }

  return NextResponse.json(response)
}
