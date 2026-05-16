import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: attempts, error } = await supabase
    .from("test_attempts")
    .select("id, score_pct, time_taken_secs, total_answered, completed_at, started_at, status, config_snapshot")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 })

  return NextResponse.json({ attempts: attempts ?? [] })
}
