import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string; id: string }> }
) {
  const { planId, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.milestone_type) updates.milestone_type = body.milestone_type
  if (body.topic_notes !== undefined) updates.topic_notes = body.topic_notes

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })

  const { data, error } = await supabase
    .from("pacing_milestones")
    .update(updates)
    .eq("id", id)
    .eq("plan_id", planId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestone: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ planId: string; id: string }> }
) {
  const { planId, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("pacing_milestones")
    .delete()
    .eq("id", id)
    .eq("plan_id", planId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
