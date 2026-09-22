import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: plan } = await supabase
    .from("pacing_plans").select("id").eq("id", planId).eq("teacher_id", user.id).single()
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 })

  const body = await request.json()
  const items = Array.isArray(body) ? body : [body]

  const records = items.map((item: {
    node_id: string; node_level: string; node_title: string
    month: number; week_in_month: number; topic_notes?: string
    milestone_type?: string
  }) => ({
    plan_id: planId,
    node_id: item.node_id,
    node_level: item.node_level,
    node_title: item.node_title,
    month: item.month,
    week_in_month: item.week_in_month,
    topic_notes: item.topic_notes ?? null,
    milestone_type: item.milestone_type ?? 'teach',
  }))

  const { data, error } = await supabase
    .from("pacing_milestones")
    .upsert(records, { onConflict: "plan_id,node_id" })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestones: data }, { status: 201 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: plan } = await supabase
    .from("pacing_plans").select("id").eq("id", planId).eq("teacher_id", user.id).single()
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 })

  const body = await request.json()
  const { milestone_type, node_levels } = body as { milestone_type: string; node_levels?: string[] }
  if (!["teach", "revise", "assess"].includes(milestone_type))
    return NextResponse.json({ error: "Invalid milestone_type." }, { status: 400 })

  let query = supabase
    .from("pacing_milestones")
    .update({ milestone_type })
    .eq("plan_id", planId)

  if (node_levels && node_levels.length > 0)
    query = query.in("node_level", node_levels)

  const { data, error } = await query.select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestones: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: plan } = await supabase
    .from("pacing_plans").select("id").eq("id", planId).eq("teacher_id", user.id).single()
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 })

  const { error } = await supabase
    .from("pacing_milestones")
    .delete()
    .eq("plan_id", planId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
