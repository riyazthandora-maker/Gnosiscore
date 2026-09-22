import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini, withRetry, QUIZ_MODEL } from "@/lib/ai/gemini"

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

interface FlatBlock { id: string; level: string; text: string }

function extractChapters(blocks: FlatBlock[]) {
  return blocks
    .filter(b => b.level === "chapter")
    .map(b => ({ node_id: b.id, title: b.text }))
}

function getDescendants(blocks: FlatBlock[], nodeId: string): FlatBlock[] {
  const idx = blocks.findIndex(b => b.id === nodeId)
  if (idx === -1) return []
  const current = blocks[idx]
  const result: FlatBlock[] = []
  for (let i = idx + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (current.level === "chapter" && b.level === "chapter") break
    result.push(b)
  }
  return result
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { instruction } = await request.json() as { instruction: string }
  if (!instruction?.trim()) return NextResponse.json({ error: "Instruction is required." }, { status: 400 })

  const { data: plan } = await supabase
    .from("pacing_plans")
    .select("id, start_month, academic_year, books ( blocks )")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()

  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 })

  const blocks = ((plan.books as unknown as { blocks: FlatBlock[] } | null)?.blocks ?? []) as FlatBlock[]
  const chapters = extractChapters(blocks)
  const startMonth = plan.start_month as number

  const chapterList = chapters
    .map((c, i) => `${i + 1}. ID="${c.node_id}" | Title="${c.title}"`)
    .join("\n")

  const monthList = Array.from({ length: 12 }, (_, i) => {
    const m = ((startMonth - 1 + i) % 12) + 1
    return `Month ${m} = ${MONTH_NAMES[m - 1]}`
  }).join(", ")

  const systemPrompt = `You are a curriculum scheduling assistant. Parse the teacher's natural language instruction and map chapters to specific week/month slots. Months are numbered 1-12 by calendar (January=1). Only use the exact chapter IDs provided. Return ONLY a valid JSON array, no markdown.`
  const userPrompt = `Available chapters:\n${chapterList}\n\nAvailable months (academic year starts month ${startMonth}): ${monthList}\n\nTeacher instruction: "${instruction}"\n\nReturn JSON array:\n[{"node_id":"...","month":3,"week_in_month":1},...]`

  try {
    const result = await withRetry(() =>
      callGemini({ model: QUIZ_MODEL, systemInstruction: systemPrompt, contents: userPrompt, maxOutputTokens: 1024, temperature: 0.1 })
    )
    const cleaned = result.text.replace(/```json|```/g, "").trim()
    const chapterAssignments: { node_id: string; month: number; week_in_month: number }[] = JSON.parse(cleaned)

    // Expand chapter assignments to include all descendants
    const seen = new Set<string>()
    const milestones: { node_id: string; node_level: string; node_title: string; month: number; week_in_month: number }[] = []

    for (const assignment of chapterAssignments) {
      if (seen.has(assignment.node_id)) continue
      seen.add(assignment.node_id)
      const block = blocks.find(b => b.id === assignment.node_id)
      if (!block) continue

      milestones.push({ node_id: block.id, node_level: block.level, node_title: block.text, month: assignment.month, week_in_month: assignment.week_in_month })

      const descendants = getDescendants(blocks, block.id)
      for (const d of descendants) {
        if (seen.has(d.id)) continue
        seen.add(d.id)
        milestones.push({ node_id: d.id, node_level: d.level, node_title: d.text, month: assignment.month, week_in_month: assignment.week_in_month })
      }
    }

    return NextResponse.json({ milestones, preview: true })
  } catch (err) {
    return NextResponse.json({ error: `Could not parse instruction: ${err instanceof Error ? err.message : "Unknown error"}` }, { status: 422 })
  }
}
