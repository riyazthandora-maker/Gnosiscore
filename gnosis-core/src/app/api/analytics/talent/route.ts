import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateTalentInsight } from "@/lib/ai/talent-generator"
import type { ExamQuestion } from "@/types"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { session_id } = await request.json() as { session_id: string }
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 })

  // Check if talent insight already exists for this session
  const { data: existing } = await supabase
    .from("diagnostic_reports")
    .select("*")
    .eq("user_id", user.id)
    .eq("session_id", session_id)
    .eq("report_type", "talent")
    .maybeSingle()

  if (existing) return NextResponse.json({ report: existing })

  const adminDb = createAdminClient()

  // Fetch session + assignment + paper questions
  const { data: session, error: sessionErr } = await adminDb
    .from("exam_sessions")
    .select("answers, assignment_id")
    .eq("id", session_id)
    .eq("student_user_id", user.id)
    .in("status", ["submitted", "auto_submitted"])
    .single()

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Session not found or not submitted" }, { status: 404 })
  }

  const { data: assignment } = await adminDb
    .from("exam_assignments")
    .select("paper_id")
    .eq("id", session.assignment_id)
    .single()

  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

  const { data: paper } = await adminDb
    .from("exam_papers")
    .select("questions")
    .eq("id", assignment.paper_id)
    .single()

  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 })

  // Fetch student grade
  const { data: profile } = await adminDb
    .from("users")
    .select("grade")
    .eq("id", user.id)
    .single()

  const grade = (profile?.grade as string) ?? "Unknown"
  const answers = (session.answers as Record<string, string>) ?? {}
  const questions = (paper.questions as ExamQuestion[]) ?? []

  const questionAnswers = questions.map((q) => ({
    id: q.id,
    body: q.body,
    topic: q.topic,
    correct: q.correct,
    chosen: answers[q.id],
  }))

  let talent
  try {
    talent = await generateTalentInsight(questionAnswers, grade)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate talent insight."
    return NextResponse.json({ error: message }, { status: 422 })
  }

  // Store as diagnostic_report with report_type='talent'
  const { data: report, error: insertErr } = await supabase
    .from("diagnostic_reports")
    .insert({
      user_id: user.id,
      session_id,
      report_type: "talent",
      strengths: [
        { topic: "Arts", confidence_pct: talent.arts },
        { topic: "Language", confidence_pct: talent.language },
        { topic: "Maths", confidence_pct: talent.maths },
      ],
      weaknesses: [],
      raw_narrative: talent.raw_narrative,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: "Failed to save talent insight." }, { status: 500 })

  return NextResponse.json({ report }, { status: 201 })
}
