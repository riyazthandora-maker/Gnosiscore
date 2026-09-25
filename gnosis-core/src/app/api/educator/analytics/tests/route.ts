import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { firstAttempt, meanPct, scorePct, type SessionScoreRow } from "@/lib/exam/scoring"

interface PaperAssignmentRow {
  id: string
  paper_id: string
  threshold_pass: number
  exam_sessions: SessionScoreRow[]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: papers } = await supabase
    .from("exam_papers")
    .select("id, title, questions, created_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  if (!papers?.length) return NextResponse.json({ tests: [] })

  const { data: assignmentData } = await supabase
    .from("exam_assignments")
    .select("id, paper_id, threshold_pass, exam_sessions(status, score, max_score, attempt_number, completed_at)")
    .eq("assigned_by", user.id)

  const assignments = (assignmentData ?? []) as unknown as PaperAssignmentRow[]

  const byPaper = new Map<string, PaperAssignmentRow[]>()
  for (const a of assignments) {
    const list = byPaper.get(a.paper_id)
    if (list) list.push(a)
    else byPaper.set(a.paper_id, [a])
  }

  const tests = papers.map((paper) => {
    const mine = byPaper.get(paper.id) ?? []

    const attempts = mine
      .map((a) => ({ attempt: firstAttempt(a.exam_sessions ?? []), passMark: a.threshold_pass }))
      .filter((x): x is { attempt: SessionScoreRow; passMark: number } => x.attempt !== null)

    const scored = attempts
      .map(({ attempt, passMark }) => ({ pct: scorePct(attempt), passMark }))
      .filter((x): x is { pct: number; passMark: number } => x.pct !== null)

    return {
      id: paper.id,
      title: paper.title,
      question_count: Array.isArray(paper.questions) ? paper.questions.length : 0,
      created_at: paper.created_at,
      assigned: mine.length,
      completed: attempts.length,
      avg_score: meanPct(scored.map((s) => s.pct)),
      pass_rate: scored.length > 0
        ? Math.round((scored.filter((s) => s.pct >= s.passMark).length / scored.length) * 100)
        : null,
    }
  })

  return NextResponse.json({ tests })
}
