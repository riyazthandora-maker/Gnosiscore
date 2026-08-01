import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") ?? "pending_admin"

  let query = supabase
    .from("generation_requests")
    .select(`
      id, question_count, prompt_context, config, chapter_ids, prompt_pct, toughness, status, admin_note, created_at, reviewed_at,
      users!generation_requests_requested_by_fkey(full_name, email)
    `)
    .order("created_at", { ascending: false })

  if (status !== "all") {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data })
}
