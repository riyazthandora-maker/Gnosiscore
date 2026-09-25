import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { genAI, DIAGNOSTIC_MODEL, withRetry } from "@/lib/ai/gemini"
import { firstAttempt, isCompleted, scorePct, type SessionScoreRow } from "@/lib/exam/scoring"
import type { ExamQuestion } from "@/types"

type SessionRow = SessionScoreRow & { id: string; answers: Record<string, string> | null }

interface AssignmentRow {
  id: string
  paper_id: string
  exam_papers: { id: string; title: string; questions: ExamQuestion[] } | null
  exam_sessions: SessionRow[]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fall back to auth metadata — the profile row can be missing if the student
  // signed up while the on_auth_user_created trigger was absent.
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role ?? (user.user_metadata?.role as string | undefined)
  if (role !== "educator_parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // The teacher↔student link lives in student_roster. RLS already scopes this to
  // rows owned by the caller, so a missing row means "not your student".
  const { data: entry } = await supabase
    .from("student_roster")
    .select("id, name, email")
    .eq("teacher_id", user.id)
    .eq("student_user_id", studentId)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Student not linked to your account." }, { status: 403 })

  const student = { id: studentId, full_name: entry.name, email: entry.email }

  const { data: assignmentData } = await supabase
    .from("exam_assignments")
    .select(`
      id, paper_id,
      exam_papers ( id, title, questions ),
      exam_sessions ( id, status, score, max_score, attempt_number, completed_at, answers )
    `)
    .eq("student_roster_id", entry.id)
    .eq("assigned_by", user.id)

  const assignments = (assignmentData ?? []) as unknown as AssignmentRow[]

  // One row per exam — the first attempt, so retakes don't double-count.
  const attempts = assignments
    .map((assignment) => ({ assignment, attempt: firstAttempt(assignment.exam_sessions ?? []) }))
    .filter((x): x is { assignment: AssignmentRow; attempt: SessionRow } => x.attempt !== null)

  const examHistory = attempts.map(({ assignment, attempt }) => {
    const completedCount = (assignment.exam_sessions ?? []).filter((s) => isCompleted(s.status)).length
    return {
      attempt_id: attempt.id,
      test_id: assignment.paper_id,
      test_title: assignment.exam_papers?.title ?? "Unknown",
      score: attempt.score ?? 0,
      max_score: attempt.max_score ?? 0,
      pct: scorePct(attempt) ?? 0,
      completed_at: attempt.completed_at ?? "",
      total_attempts: completedCount,
    }
  })

  // Class average per paper, across every student the teacher assigned it to
  const paperIds = [...new Set(attempts.map(({ assignment }) => assignment.paper_id))]
  const classAverages: Record<string, number> = {}
  if (paperIds.length > 0) {
    const { data: classData } = await supabase
      .from("exam_assignments")
      .select("paper_id, exam_sessions ( status, score, max_score, attempt_number, completed_at )")
      .eq("assigned_by", user.id)
      .in("paper_id", paperIds)

    const grouped: Record<string, number[]> = {}
    const rows = (classData ?? []) as unknown as { paper_id: string; exam_sessions: SessionScoreRow[] }[]
    for (const row of rows) {
      const attempt = firstAttempt(row.exam_sessions ?? [])
      if (!attempt) continue
      const pct = scorePct(attempt)
      if (pct === null) continue
      ;(grouped[row.paper_id] ??= []).push(pct)
    }

    for (const [paperId, values] of Object.entries(grouped)) {
      classAverages[paperId] = Math.round(values.reduce((s, v) => s + v, 0) / values.length)
    }
  }

  // Topic accuracy — derived from the paper's own questions, no questions table
  const topicStats: Record<string, { correct: number; total: number }> = {}
  for (const { assignment, attempt } of attempts) {
    const answers = attempt.answers ?? {}
    for (const question of assignment.exam_papers?.questions ?? []) {
      const topic = question.topic
      if (!topic) continue
      if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 }
      topicStats[topic].total++
      if (answers[question.id] === question.correct) topicStats[topic].correct++
    }
  }

  const topicAccuracy = Object.entries(topicStats)
    .map(([topic, { correct, total }]) => ({
      topic,
      correct,
      total,
      accuracy_pct: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)

  const scoreTrend = [...examHistory]
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
    .map((e) => ({ test_title: e.test_title, pct: e.pct, completed_at: e.completed_at }))

  let aiAdvisory: string | null = null
  if (examHistory.length > 0 && topicAccuracy.length > 0) {
    try {
      const strengths = topicAccuracy.filter((t) => t.accuracy_pct >= 70).slice(0, 5)
      const weaknesses = topicAccuracy.filter((t) => t.accuracy_pct < 60).slice(0, 5)
      const avgScore = Math.round(examHistory.reduce((s, e) => s + e.pct, 0) / examHistory.length)
      const trend = scoreTrend.length >= 2
        ? scoreTrend[scoreTrend.length - 1].pct - scoreTrend[0].pct
        : 0

      const prompt = `You are an educational advisor. A teacher needs a short advisory about a student to share with the student or parents.

Student: ${student.full_name}
Tests taken: ${examHistory.length}
Average score: ${avgScore}%
Score trend: ${trend > 5 ? "improving" : trend < -5 ? "declining" : "stable"}
Strong topics: ${strengths.map((t) => `${t.topic} (${t.accuracy_pct}%)`).join(", ") || "None identified"}
Weak topics: ${weaknesses.map((t) => `${t.topic} (${t.accuracy_pct}%)`).join(", ") || "None identified"}

Write a 3-4 sentence advisory for the teacher/parent. Be encouraging, specific, and actionable. Do not use bullet points. Plain paragraph only.`

      const response = await withRetry(() =>
        genAI.models.generateContent({
          model: DIAGNOSTIC_MODEL,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        })
      )
      aiAdvisory = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
    } catch {
      aiAdvisory = null
    }
  }

  return NextResponse.json({
    student,
    exam_history: examHistory,
    class_averages: classAverages,
    topic_accuracy: topicAccuracy,
    score_trend: scoreTrend,
    ai_advisory: aiAdvisory,
  })
}
