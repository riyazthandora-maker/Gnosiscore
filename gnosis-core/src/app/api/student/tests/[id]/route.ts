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

  // Verify student has an assignment for this test
  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("id, due_at")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .single()

  if (!assignment) return NextResponse.json({ error: "Test not assigned to you." }, { status: 403 })

  // Check for a completed attempt (no retakes)
  const { data: attempt } = await supabase
    .from("test_attempts")
    .select("id")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)
    .single()

  if (attempt) {
    return NextResponse.json({ attempted: true, attempt_id: attempt.id })
  }

  // Fetch test
  const { data: test, error: testErr } = await supabase
    .from("tests")
    .select("id, title, description, question_ids, time_limit_min")
    .eq("id", testId)
    .eq("is_published", true)
    .single()

  if (testErr || !test) return NextResponse.json({ error: "Test not found." }, { status: 404 })

  if (test.question_ids.length === 0) {
    return NextResponse.json({ error: "Test has no questions." }, { status: 400 })
  }

  // Fetch questions — strip is_correct from options so client can't cheat
  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, options, difficulty, topic_tags")
    .in("id", test.question_ids)
    .eq("status", "approved")

  if (!questions) return NextResponse.json({ error: "Failed to load questions." }, { status: 500 })

  // Preserve order from test.question_ids and strip is_correct
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

  return NextResponse.json({
    attempted: false,
    test: { ...test, questions: ordered, due_at: assignment.due_at },
  })
}
