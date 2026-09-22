import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini, withRetry, QUIZ_MODEL } from "@/lib/ai/gemini"
import type { DifficultyBands } from "@/types"

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
    .select("id, academic_year, start_month, difficulty_bands")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const startMonth = plan.start_month as number
  const academicYear = plan.academic_year as string
  const bands = (plan.difficulty_bands as DifficultyBands) ?? { low: [60, 70], medium: [70, 80], high: [80, 100] }
  const threshold = bands.low[0]
  const [y1str, y2str] = academicYear.split("-")
  const y1 = parseInt(y1str)
  const y2 = parseInt(y2str)

  const { data: milestones } = await supabase
    .from("pacing_milestones")
    .select("id, node_id, node_title, milestone_type, month, week_in_month, auto_exam_paper_id")
    .eq("plan_id", planId)

  const assessPaperIds = (milestones ?? [])
    .filter(m => m.milestone_type === "assess" && m.auto_exam_paper_id)
    .map(m => m.auto_exam_paper_id as string)

  // Collect scores per paper
  const paperScores: Record<string, number[]> = {}

  if (assessPaperIds.length > 0) {
    const { data: assignments } = await supabase
      .from("exam_assignments")
      .select("paper_id, exam_sessions(status, score, max_score)")
      .in("paper_id", assessPaperIds)

    for (const asgn of assignments ?? []) {
      const pid = asgn.paper_id as string
      if (!paperScores[pid]) paperScores[pid] = []
      const sessions = (asgn.exam_sessions ?? []) as { status: string; score: number | null; max_score: number | null }[]
      const done = sessions.find(s => s.status === "submitted" || s.status === "auto_submitted")
      if (done?.score !== null && done?.score !== undefined && done.max_score && done.max_score > 0) {
        paperScores[pid].push((done.score / done.max_score) * 100)
      }
    }
  }

  const avgForPaper = (pid: string): number | null => {
    const scores = paperScores[pid]
    if (!scores?.length) return null
    return scores.reduce((s, v) => s + v, 0) / scores.length
  }

  // Sort milestones by academic-year slot
  const sorted = [...(milestones ?? [])].sort((a, b) => {
    const ai = ((a.month - startMonth + 12) % 12) * 4 + (a.week_in_month - 1)
    const bi = ((b.month - startMonth + 12) % 12) * 4 + (b.week_in_month - 1)
    return ai - bi
  })

  const lowScoring = sorted.filter(m => {
    if (m.milestone_type !== "assess" || !m.auto_exam_paper_id) return false
    const avg = avgForPaper(m.auto_exam_paper_id as string)
    return avg !== null && avg < threshold
  })

  if (lowScoring.length === 0) {
    return NextResponse.json({
      suggestion: null,
      message: `No assess milestones below the ${threshold}% threshold.`,
    })
  }

  const allRows = sorted.map(m => {
    const year = (m.month as number) >= startMonth ? y1 : y2
    return `${m.node_title} | ${m.milestone_type ?? "teach"} | ${m.month}/${m.week_in_month} (${year})`
  }).join("\n")

  const lowRows = lowScoring.map(m => {
    const avg = avgForPaper(m.auto_exam_paper_id as string)
    const year = (m.month as number) >= startMonth ? y1 : y2
    return `NodeID:${m.node_id} | ${m.node_title} | ${m.month}/${m.week_in_month} (${year}) | AvgScore: ${Math.round(avg ?? 0)}%`
  }).join("\n")

  const systemPrompt = `You are a curriculum assistant. Chapters with low exam scores need revision sessions inserted into the schedule to help students before they fall further behind.

For each low-scoring chapter, suggest inserting a "Revision: [chapter]" session in an appropriate slot shortly after the assess milestone.

Return ONLY a JSON object — no markdown, no text outside JSON:
{
  "reasoning": "1-2 sentence explanation of why revision is needed and what you're adding",
  "inserts": [
    {
      "original_node_id": "<node_id of the assessed chapter>",
      "node_title": "Revision: <chapter title>",
      "insert_month": <1-12>,
      "insert_week": <1-4>
    }
  ]
}`

  const userMessage = `Academic year: ${academicYear}, starts month ${startMonth}
Low-band threshold: ${threshold}%

Low-scoring chapters (below ${threshold}%):
NodeID | Title | Month/Week (Year) | AvgScore%
${lowRows}

All scheduled milestones (for context on available gaps):
Title | Type | Month/Week (Year)
${allRows}

Suggest inserting a revision session for each low-scoring chapter. Place it in the week immediately after the assess slot or the next available gap. Return the calendar month (1–12) and week (1–4) for each insertion.`

  let parsed: {
    reasoning: string
    inserts: Array<{ original_node_id: string; node_title: string; insert_month: number; insert_week: number }>
  }

  try {
    const result = await withRetry(() => callGemini({
      model:             QUIZ_MODEL,
      systemInstruction: systemPrompt,
      contents:          userMessage,
      maxOutputTokens:   1024,
      temperature:       0.3,
    }))
    const match = result.text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON in response")
    parsed = JSON.parse(match[0])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 500 })
  }

  if (!parsed.inserts || parsed.inserts.length === 0) {
    return NextResponse.json({ suggestion: null, message: parsed.reasoning ?? "No remediation inserts suggested." })
  }

  const { data: saved, error: saveErr } = await supabase
    .from("pacing_suggestions")
    .insert({
      plan_id:         planId,
      suggestion_type: "insert_revise",
      status:          "pending",
      payload:         { inserts: parsed.inserts },
      ai_reasoning:    parsed.reasoning,
    })
    .select()
    .single()

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  await supabase.from("pacing_events").insert({
    plan_id:      planId,
    event_type:   "remediation_suggested",
    payload:      { suggestion_id: saved.id, inserts_count: parsed.inserts.length },
    triggered_by: user.id,
  })

  return NextResponse.json({ suggestion: saved })
}
