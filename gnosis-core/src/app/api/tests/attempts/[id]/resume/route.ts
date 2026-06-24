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
    .select("id, student_id, paused_at, total_paused_seconds, completed_at")
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .single()

  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 })
  if (attempt.completed_at) return NextResponse.json({ error: "Attempt already completed." }, { status: 400 })
  if (!attempt.paused_at) return NextResponse.json({ error: "Attempt is not paused." }, { status: 400 })

  const pausedAt = new Date(attempt.paused_at)
  const now = new Date()
  const pausedSeconds = Math.floor((now.getTime() - pausedAt.getTime()) / 1000)
  const newTotal = (attempt.total_paused_seconds ?? 0) + pausedSeconds

  const { max_pause_duration_seconds } = await getPlatformSettings()

  // If they've exceeded max pause time, auto-submit
  if (newTotal >= max_pause_duration_seconds) {
    await supabase
      .from("test_attempts")
      .update({
        paused_at: null,
        total_paused_seconds: newTotal,
        completed_at: now.toISOString(),
        answers: attempt,
      })
      .eq("id", attemptId)
    return NextResponse.json({ resumed: false, auto_submitted: true })
  }

  const { error } = await supabase
    .from("test_attempts")
    .update({
      paused_at: null,
      total_paused_seconds: newTotal,
      last_heartbeat_at: now.toISOString(),
    })
    .eq("id", attemptId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    resumed: true,
    paused_seconds_this_session: pausedSeconds,
    total_paused_seconds: newTotal,
    remaining_pause_seconds: Math.max(0, max_pause_duration_seconds - newTotal),
  })
}
