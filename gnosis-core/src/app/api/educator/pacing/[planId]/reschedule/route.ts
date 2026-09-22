import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini, withRetry, QUIZ_MODEL } from "@/lib/ai/gemini"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: plan } = await supabase
    .from("pacing_plans")
    .select("id, academic_year, start_month")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const startMonth = plan.start_month as number
  const academicYear = plan.academic_year as string
  const [y1str, y2str] = academicYear.split("-")
  const y1 = parseInt(y1str)
  const y2 = parseInt(y2str)

  const { data: milestones } = await supabase
    .from("pacing_milestones")
    .select("id, node_title, milestone_type, month, week_in_month, auto_exam_paper_id")
    .eq("plan_id", planId)

  // Gather exam completion stats for assess milestones
  const assessPaperIds = (milestones ?? [])
    .filter(m => m.milestone_type === "assess" && m.auto_exam_paper_id)
    .map(m => m.auto_exam_paper_id as string)

  const paperStats: Record<string, { total: number; completed: number; scores: number[] }> = {}

  if (assessPaperIds.length > 0) {
    const { data: assignments } = await supabase
      .from("exam_assignments")
      .select("paper_id, exam_sessions(status, score, max_score)")
      .in("paper_id", assessPaperIds)

    for (const asgn of assignments ?? []) {
      const pid = asgn.paper_id as string
      if (!paperStats[pid]) paperStats[pid] = { total: 0, completed: 0, scores: [] }
      paperStats[pid].total += 1
      const sessions = (asgn.exam_sessions ?? []) as { status: string; score: number | null; max_score: number | null }[]
      const done = sessions.find(s => s.status === "submitted" || s.status === "auto_submitted")
      if (done) {
        paperStats[pid].completed += 1
        if (done.score !== null && done.max_score && done.max_score > 0) {
          paperStats[pid].scores.push((done.score / done.max_score) * 100)
        }
      }
    }
  }

  // Sort milestones by academic-year slot
  const sorted = [...(milestones ?? [])].sort((a, b) => {
    const ai = ((a.month - startMonth + 12) % 12) * 4 + (a.week_in_month - 1)
    const bi = ((b.month - startMonth + 12) % 12) * 4 + (b.week_in_month - 1)
    return ai - bi
  })

  const milestoneRows = sorted.map(m => {
    const ps = m.auto_exam_paper_id ? (paperStats[m.auto_exam_paper_id] ?? null) : null
    const year = (m.month as number) >= startMonth ? y1 : y2
    const completionPct = ps?.total ? Math.round((ps.completed / ps.total) * 100) : null
    const avgScore = ps?.scores.length
      ? Math.round(ps.scores.reduce((s, v) => s + v, 0) / ps.scores.length)
      : null
    return [
      m.id,
      m.node_title,
      m.milestone_type ?? "teach",
      `${m.month}/${m.week_in_month} (${year})`,
      completionPct !== null ? `${completionPct}%` : "—",
      avgScore     !== null ? `${avgScore}%`      : "—",
    ].join(" | ")
  }).join("\n")

  const today = new Date().toISOString().split("T")[0]

  const systemPrompt = `You are a curriculum scheduling assistant. Analyze the pacing plan and suggest rescheduling future milestones where the class is falling behind.

Return ONLY a JSON object — no markdown, no text outside JSON:
{
  "reasoning": "1-2 sentence explanation of what you recommend and why",
  "moves": [
    {
      "milestone_id": "<uuid>",
      "node_title": "<chapter title>",
      "from_month": <1-12>,
      "from_week": <1-4>,
      "to_month": <1-12>,
      "to_week": <1-4>
    }
  ]
}`

  const userMessage = `Pacing plan: ${academicYear}, starts month ${startMonth}
Today: ${today}

Milestones (ID | Title | Type | Month/Week (Year) | Completion% | AvgScore%):
${milestoneRows || "No milestones scheduled yet."}

Suggest moving future milestones (scheduled after today) to later slots where completion rates or scores indicate the class is behind. Only move milestones within the same academic year. If the schedule looks on track, return an empty moves array.`

  let parsed: {
    reasoning: string
    moves: Array<{ milestone_id: string; node_title: string; from_month: number; from_week: number; to_month: number; to_week: number }>
  }

  try {
    const result = await withRetry(() => callGemini({
      model:             QUIZ_MODEL,
      systemInstruction: systemPrompt,
      contents:          userMessage,
      maxOutputTokens:   1024,
      temperature:       0.2,
    }))
    const match = result.text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")
    parsed = JSON.parse(match[0])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 500 })
  }

  if (!parsed.moves || parsed.moves.length === 0) {
    return NextResponse.json({ suggestion: null, message: parsed.reasoning ?? "No rescheduling needed." })
  }

  const { data: saved, error: saveErr } = await supabase
    .from("pacing_suggestions")
    .insert({
      plan_id:         planId,
      suggestion_type: "reschedule",
      status:          "pending",
      payload:         { moves: parsed.moves },
      ai_reasoning:    parsed.reasoning,
    })
    .select()
    .single()

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  await supabase.from("pacing_events").insert({
    plan_id:      planId,
    event_type:   "reschedule_suggested",
    payload:      { suggestion_id: saved.id, moves_count: parsed.moves.length },
    triggered_by: user.id,
  })

  return NextResponse.json({ suggestion: saved })
}
