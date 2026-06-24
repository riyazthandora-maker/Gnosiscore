import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getPlatformSettings } from "@/lib/platform-settings"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: attempt } = await supabase
    .from("test_attempts")
    .select("id, student_id, test_id, paused_at, total_paused_seconds, completed_at")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .single()

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 })
  if (attempt.completed_at) return NextResponse.json({ error: "Attempt already completed." }, { status: 400 })
  if (attempt.paused_at) return NextResponse.json({ error: "Already paused." }, { status: 400 })

  // Check test allows pause
  const { data: test } = await supabase
    .from("tests")
    .select("allow_pause")
    .eq("id", attempt.test_id)
    .single()

  if (!test?.allow_pause) {
    return NextResponse.json({ error: "Pause is not enabled for this test." }, { status: 403 })
  }

  // Check max pause duration hasn't been exceeded
  const { max_pause_duration_seconds } = await getPlatformSettings()
  if ((attempt.total_paused_seconds ?? 0) >= max_pause_duration_seconds) {
    return NextResponse.json({ error: "Maximum pause duration reached." }, { status: 403 })
  }

  const { error } = await supabase
    .from("test_attempts")
    .update({ paused_at: new Date().toISOString() })
    .eq("id", attemptId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    paused: true,
    total_paused_seconds: attempt.total_paused_seconds ?? 0,
    max_pause_duration_seconds,
  })
}
