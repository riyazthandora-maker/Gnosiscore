import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("platform_settings")
    .select("file_size_limit_bytes, question_approval_threshold, max_pause_duration_seconds, updated_at")
    .eq("id", 1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json() as {
    file_size_limit_bytes?: number
    question_approval_threshold?: number
    max_pause_duration_seconds?: number
  }

  const updates: Record<string, number | string> = { updated_at: new Date().toISOString() }

  if (body.file_size_limit_bytes !== undefined) {
    const v = Number(body.file_size_limit_bytes)
    if (!Number.isInteger(v) || v < 1024 * 1024) {
      return NextResponse.json({ error: "file_size_limit_bytes must be at least 1 MB." }, { status: 400 })
    }
    updates.file_size_limit_bytes = v
  }

  if (body.question_approval_threshold !== undefined) {
    const v = Number(body.question_approval_threshold)
    if (!Number.isInteger(v) || v < 1) {
      return NextResponse.json({ error: "question_approval_threshold must be at least 1." }, { status: 400 })
    }
    updates.question_approval_threshold = v
  }

  if (body.max_pause_duration_seconds !== undefined) {
    const v = Number(body.max_pause_duration_seconds)
    if (!Number.isInteger(v) || v < 60) {
      return NextResponse.json({ error: "max_pause_duration_seconds must be at least 60." }, { status: 400 })
    }
    updates.max_pause_duration_seconds = v
  }

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from("platform_settings")
    .update(updates)
    .eq("id", 1)
    .select("file_size_limit_bytes, question_approval_threshold, max_pause_duration_seconds, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
