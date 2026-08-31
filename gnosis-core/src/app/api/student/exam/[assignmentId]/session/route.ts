import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendSubmissionNotificationEmail } from "@/lib/email/send-submission-notification"
import type { ExamQuestion } from "@/types"

type Params = { params: Promise<{ assignmentId: string }> }

// POST /api/student/exam/[assignmentId]/session  → create or fetch active session
export async function POST(_req: Request, { params }: Params) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify student has access to this assignment
  const { data: assignment, error: aErr } = await supabase
    .from("exam_assignments")
    .select("*, exam_papers(id, title, questions)")
    .eq("id", assignmentId)
    .single()

  if (aErr || !assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

  // Check attempt limit
  const { count } = await supabase
    .from("exam_sessions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId)
    .eq("student_user_id", user.id)
    .in("status", ["submitted", "auto_submitted"])

  const completedAttempts = count ?? 0
  if (completedAttempts >= (assignment.max_attempts as number)) {
    return NextResponse.json({ error: "Attempt limit reached" }, { status: 403 })
  }

  // Check for existing active session
  const { data: existing } = await supabase
    .from("exam_sessions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_user_id", user.id)
    .in("status", ["lobby", "in_progress", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (existing) return NextResponse.json({ session: existing })

  // Create new session
  const { data: session, error: sErr } = await supabase
    .from("exam_sessions")
    .insert({
      assignment_id: assignmentId,
      student_user_id: user.id,
      status: "lobby",
      attempt_number: completedAttempts + 1,
    })
    .select()
    .single()

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  return NextResponse.json({ session })
}

// PATCH /api/student/exam/[assignmentId]/session → update session state
export async function PATCH(req: Request, { params }: Params) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    session_id: string
    action: "start" | "save_answers" | "flag" | "pause" | "submit" | "auto_submit"
    answers?: Record<string, string>
    flagged_questions?: string[]
    elapsed_seconds?: number
    tab_switch_count?: number
  }

  const { session_id, action } = body

  // Fetch session
  const { data: session, error: sErr } = await supabase
    .from("exam_sessions")
    .select("*")
    .eq("id", session_id)
    .eq("assignment_id", assignmentId)
    .eq("student_user_id", user.id)
    .single()

  if (sErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (action === "start") {
    updates.status = "in_progress"
    updates.started_at = new Date().toISOString()
  }

  if (action === "save_answers" || action === "submit" || action === "auto_submit") {
    if (body.answers !== undefined) updates.answers = body.answers
    if (body.flagged_questions !== undefined) updates.flagged_questions = body.flagged_questions
    if (body.elapsed_seconds !== undefined) updates.elapsed_seconds = body.elapsed_seconds
    if (body.tab_switch_count !== undefined) updates.tab_switch_count = body.tab_switch_count
  }

  if (action === "flag") {
    if (body.flagged_questions !== undefined) updates.flagged_questions = body.flagged_questions
  }

  if (action === "pause") {
    updates.status = "paused"
    updates.paused_at = new Date().toISOString()
    if (body.elapsed_seconds !== undefined) updates.elapsed_seconds = body.elapsed_seconds
  }

  if (action === "submit" || action === "auto_submit") {
    // Grade the exam
    const { data: assignment } = await supabase
      .from("exam_assignments")
      .select("exam_papers(questions), release_results_immediately, show_explanations, threshold_excellent, threshold_distinction, threshold_pass, assigned_by")
      .eq("id", assignmentId)
      .single()

    const questions: ExamQuestion[] = (assignment as { exam_papers?: { questions?: ExamQuestion[] } } | null)?.exam_papers?.questions ?? []
    const submittedAnswers = (body.answers ?? session.answers) as Record<string, string>
    const { score, maxScore } = grade(questions, submittedAnswers)

    updates.status = action === "auto_submit" ? "auto_submitted" : "submitted"
    updates.completed_at = new Date().toISOString()
    updates.score = score
    updates.max_score = maxScore

    // Notify educator (fire-and-forget)
    const adminDb = createAdminClient()
    const assignedBy = (assignment as { assigned_by?: string } | null)?.assigned_by ?? ""
    void Promise.all([
      Promise.resolve(adminDb.from("profiles").select("full_name, email").eq("id", assignedBy).single()),
      Promise.resolve(adminDb.from("profiles").select("full_name").eq("id", user.id).single()),
      Promise.resolve(adminDb.from("exam_assignments").select("exam_papers(title)").eq("id", assignmentId).single()),
    ]).then(([teacherRes, studentRes, asgnRes]) => {
      const teacher = teacherRes.data
      const studentProfile = studentRes.data
      const paperTitle = (asgnRes.data as { exam_papers?: { title?: string } } | null)?.exam_papers?.title ?? "a test"
      if (!teacher || !(teacher as { email?: string }).email) return
      return sendSubmissionNotificationEmail({
        teacherEmail: (teacher as { email: string }).email,
        teacherName: (teacher as { full_name?: string }).full_name ?? "Teacher",
        studentName: (studentProfile as { full_name?: string } | null)?.full_name ?? "A student",
        examTitle: paperTitle,
        score,
        maxScore,
        submittedAt: new Date().toISOString(),
      })
    }).catch(() => { /* non-critical */ })
  }

  const { data: updated, error: uErr } = await supabase
    .from("exam_sessions")
    .update(updates)
    .eq("id", session_id)
    .select()
    .single()

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  return NextResponse.json({ session: updated })
}

function grade(questions: ExamQuestion[], answers: Record<string, string>) {
  const maxScore = questions.length
  let score = 0
  for (const q of questions) {
    if (answers[q.id] === q.correct) score++
  }
  return { score, maxScore }
}
