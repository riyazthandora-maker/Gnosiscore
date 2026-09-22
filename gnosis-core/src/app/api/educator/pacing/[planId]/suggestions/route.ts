import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get("status")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: plan } = await supabase
    .from("pacing_plans")
    .select("id")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let query = supabase
    .from("pacing_suggestions")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })

  if (statusFilter) {
    query = query.eq("status", statusFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ suggestions: data ?? [] })
}
