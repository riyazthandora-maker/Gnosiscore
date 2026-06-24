import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Creates an in-progress attempt record so disconnection can be detected server-side.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { test_id } = await request.json() as { test_id: string }
  if (!test_id) return NextResponse.json({ error: "test_id is required." }, { status: 400 })

  // Verify assignment
  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("id")
    .eq("test_id", test_id)
    .eq("student_id", user.id)
    .single()

  if (!assignment) return NextResponse.json({ error: "Test not assigned." }, { status: 403 })

  // Reuse existing in-progress attempt if any (e.g. page refresh)
  const { data: existing } = await supabase
    .from("test_attempts")
    .select("id, answers, total_paused_seconds")
    .eq("test_id", test_id)
    .eq("student_id", user.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ attempt_id: existing.id, resumed: true, saved_answers: existing.answers })
  }

  // Determine attempt number
  const { count } = await supabase
    .from("test_attempts")
    .select("id", { count: "exact", head: true })
    .eq("test_id", test_id)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)

  const attemptNumber = (count ?? 0) + 1

  const { data: attempt, error } = await supabase
    .from("test_attempts")
    .insert({
      test_id,
      student_id: user.id,
      answers: {},
      attempt_number: attemptNumber,
      is_first_attempt: attemptNumber === 1,
      last_heartbeat_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error || !attempt) return NextResponse.json({ error: "Failed to start attempt." }, { status: 500 })

  return NextResponse.json({ attempt_id: attempt.id, resumed: false, saved_answers: {} })
}
