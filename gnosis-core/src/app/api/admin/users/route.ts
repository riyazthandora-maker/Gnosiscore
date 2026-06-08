import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") // pending | approved | rejected | all

  let query = supabase
    .from("users")
    .select("id, email, full_name, whatsapp, role, account_status, created_at, approved_at, token_cap, tokens_used")
    .eq("role", "educator_parent")
    .order("created_at", { ascending: false })

  if (status && status !== "all") {
    query = query.eq("account_status", status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data })
}
