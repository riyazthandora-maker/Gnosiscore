import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface Move {
  milestone_id: string
  to_month: number
  to_week: number
}

interface Insert {
  original_node_id: string
  node_title: string
  insert_month: number
  insert_week: number
}

function slotIdx(month: number, week: number, startMonth: number): number {
  return ((month - startMonth + 12) % 12) * 4 + (week - 1)
}

function nextSlot(month: number, week: number): { month: number; week: number } {
  if (week < 4) return { month, week: week + 1 }
  return { month: month < 12 ? month + 1 : 1, week: 1 }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ planId: string; suggestionId: string }> }
) {
  const { planId, suggestionId } = await params
  const body = await req.json() as { action: "apply" | "dismiss" }
  const { action } = body

  if (action !== "apply" && action !== "dismiss") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: suggestion, error: sgErr } = await supabase
    .from("pacing_suggestions")
    .select("id, plan_id, suggestion_type, status, payload")
    .eq("id", suggestionId)
    .eq("plan_id", planId)
    .single()

  if (sgErr || !suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (suggestion.status !== "pending") return NextResponse.json({ error: "Already acted on" }, { status: 409 })

  const actedAt = new Date().toISOString()

  if (action === "dismiss") {
    await supabase
      .from("pacing_suggestions")
      .update({ status: "dismissed", acted_at: actedAt })
      .eq("id", suggestionId)
    return NextResponse.json({ status: "dismissed" })
  }

  // action === "apply"
  if (suggestion.suggestion_type === "reschedule") {
    const payload = suggestion.payload as { moves: Move[] }
    for (const move of (payload.moves ?? [])) {
      await supabase
        .from("pacing_milestones")
        .update({ month: move.to_month, week_in_month: move.to_week })
        .eq("id", move.milestone_id)
        .eq("plan_id", planId)
    }

    await supabase
      .from("pacing_suggestions")
      .update({ status: "applied", acted_at: actedAt })
      .eq("id", suggestionId)

    await supabase.from("pacing_events").insert({
      plan_id: planId,
      event_type: "reschedule_applied",
      payload: { suggestion_id: suggestionId, moves: payload.moves?.length ?? 0 },
      triggered_by: user.id,
    })

    const { data: milestones } = await supabase
      .from("pacing_milestones")
      .select("id, node_id, node_level, node_title, month, week_in_month, topic_notes, milestone_type, auto_exam_paper_id, auto_exam_status")
      .eq("plan_id", planId)

    return NextResponse.json({ status: "applied", milestones: milestones ?? [] })
  }

  if (suggestion.suggestion_type === "insert_revise") {
    const payload = suggestion.payload as { inserts: Insert[] }
    const inserts = payload.inserts ?? []

    const { data: planRow } = await supabase
      .from("pacing_plans")
      .select("start_month")
      .eq("id", planId)
      .single()
    const startMonth = (planRow?.start_month as number) ?? 1

    const { data: allMs } = await supabase
      .from("pacing_milestones")
      .select("id, month, week_in_month, node_id")
      .eq("plan_id", planId)

    type MsRow = { id: string; month: number; week_in_month: number; node_id: string }
    const mutableMs: MsRow[] = (allMs ?? []).map(m => ({
      id:           m.id as string,
      month:        m.month as number,
      week_in_month: m.week_in_month as number,
      node_id:      m.node_id as string,
    }))

    // Sort inserts by academic-year slot (earliest first) so displacements cascade correctly
    const sortedInserts = [...inserts].sort(
      (a, b) => slotIdx(a.insert_month, a.insert_week, startMonth) - slotIdx(b.insert_month, b.insert_week, startMonth)
    )

    const newRevises: Array<{
      plan_id: string; node_id: string; node_level: string; node_title: string
      month: number; week_in_month: number; milestone_type: string
    }> = []

    for (const ins of sortedInserts) {
      const insertSlotIdx = slotIdx(ins.insert_month, ins.insert_week, startMonth)
      for (const m of mutableMs) {
        if (slotIdx(m.month, m.week_in_month, startMonth) >= insertSlotIdx) {
          const next = nextSlot(m.month, m.week_in_month)
          m.month = next.month
          m.week_in_month = next.week
        }
      }
      newRevises.push({
        plan_id:       planId,
        node_id:       `revise-${crypto.randomUUID()}`,
        node_level:    "chapter",
        node_title:    ins.node_title,
        month:         ins.insert_month,
        week_in_month: ins.insert_week,
        milestone_type: "revise",
      })
    }

    for (const m of mutableMs) {
      await supabase
        .from("pacing_milestones")
        .update({ month: m.month, week_in_month: m.week_in_month })
        .eq("id", m.id)
    }

    if (newRevises.length > 0) {
      await supabase.from("pacing_milestones").insert(newRevises)
    }

    await supabase
      .from("pacing_suggestions")
      .update({ status: "applied", acted_at: actedAt })
      .eq("id", suggestionId)

    await supabase.from("pacing_events").insert({
      plan_id: planId,
      event_type: "remediation_applied",
      payload: { suggestion_id: suggestionId, inserts: newRevises.length },
      triggered_by: user.id,
    })

    const { data: milestones } = await supabase
      .from("pacing_milestones")
      .select("id, node_id, node_level, node_title, month, week_in_month, topic_notes, milestone_type, auto_exam_paper_id, auto_exam_status")
      .eq("plan_id", planId)

    return NextResponse.json({ status: "applied", milestones: milestones ?? [] })
  }

  return NextResponse.json({ error: "Unknown suggestion type" }, { status: 400 })
}
