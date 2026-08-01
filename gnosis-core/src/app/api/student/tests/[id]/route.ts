import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("id, due_at, time_limit_minutes, show_timer, show_answer_key, allow_retake, starts_at, ends_at")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .single()

  if (!assignment) return NextResponse.json({ error: "Test not assigned to you." }, { status: 403 })

  // Enforce scheduling window
  const now = new Date()
  if (assignment.starts_at && new Date(assignment.starts_at) > now) {
    return NextResponse.json({ error: "This test is not available yet." }, { status: 403 })
  }
  if (assignment.ends_at && new Date(assignment.ends_at) < now) {
    return NextResponse.json({ error: "This test has expired." }, { status: 403 })
  }

  // Count completed attempts
  const { count: attemptCount } = await supabase
    .from("test_attempts")
    .select("id", { count: "exact", head: true })
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)

  // Enforce single-attempt policy
  if (!assignment.allow_retake && (attemptCount ?? 0) > 0) {
    return NextResponse.json({ error: "You have already completed this test and retakes are not allowed." }, { status: 403 })
  }

  const { data: test, error: testErr } = await supabase
    .from("tests")
    .select("id, title, description, question_ids, allow_pause")
    .eq("id", testId)
    .eq("is_published", true)
    .single()

  if (testErr || !test) return NextResponse.json({ error: "Test not found." }, { status: 404 })

  if (test.question_ids.length === 0) {
    return NextResponse.json({ error: "Test has no questions." }, { status: 400 })
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, options, difficulty, topic_tags")
    .in("id", test.question_ids)
    .eq("status", "approved")

  if (!questions) return NextResponse.json({ error: "Failed to load questions." }, { status: 500 })

  const ordered = (test.question_ids as string[])
    .map((qid) => {
      const q = questions.find((x) => x.id === qid)
      if (!q) return null
      return {
        ...q,
        options: (q.options as { label: string; text: string; is_correct: boolean }[]).map(
          ({ label, text }) => ({ label, text })
        ),
      }
    })
    .filter(Boolean)

  // Resolve effective time limit from assignment (0 = no limit → null)
  const effectiveTimeLimit = assignment.time_limit_minutes > 0 ? assignment.time_limit_minutes : null

  return NextResponse.json({
    attempt_count: attemptCount ?? 0,
    test: {
      ...test,
      questions: ordered,
      due_at: assignment.due_at,
      time_limit_min: effectiveTimeLimit,
      show_timer: assignment.show_timer,
      show_answer_key: assignment.show_answer_key,
      allow_retake: assignment.allow_retake,
    },
  })
}
