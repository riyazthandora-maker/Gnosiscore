import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini, withRetry, QUIZ_MODEL } from "@/lib/ai/gemini"

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

interface FlatBlock { id: string; level: string; text: string }

function extractChapters(blocks: FlatBlock[]) {
  const chapters: { node_id: string; title: string; char_count: number }[] = []
  let current: { node_id: string; title: string; char_count: number } | null = null
  for (const block of blocks) {
    if (block.level === "chapter") {
      if (current) chapters.push(current)
      current = { node_id: block.id, title: block.text, char_count: block.text.length }
    } else if (current) {
      current.char_count += block.text.length
    }
  }
  if (current) chapters.push(current)
  return chapters
}

function getDescendants(blocks: FlatBlock[], nodeId: string): FlatBlock[] {
  const idx = blocks.findIndex(b => b.id === nodeId)
  if (idx === -1) return []
  const current = blocks[idx]
  const result: FlatBlock[] = []
  for (let i = idx + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (current.level === "chapter" && b.level === "chapter") break
    if (current.level === "section" && (b.level === "chapter" || b.level === "section")) break
    result.push(b)
  }
  return result
}

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
    .select("id, start_month, academic_year, books ( blocks )")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()

  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 })

  const blocks = ((plan.books as unknown as { blocks: FlatBlock[] } | null)?.blocks ?? []) as FlatBlock[]
  const chapters = extractChapters(blocks)

  if (!chapters.length) return NextResponse.json({ error: "No chapters found in this book." }, { status: 400 })

  const startMonth = plan.start_month as number
  const chapterList = chapters
    .map((c, i) => `${i + 1}. ID="${c.node_id}" | Title="${c.title}" | Size=${c.char_count} chars`)
    .join("\n")

  const monthList = Array.from({ length: 12 }, (_, i) => {
    const m = ((startMonth - 1 + i) % 12) + 1
    return `Month ${m} = ${MONTH_NAMES[m - 1]}`
  }).join(", ")

  const systemPrompt = `You are a curriculum planning AI. Distribute book chapters across a 12-month academic calendar. Use content size as a guide — larger chapters get more weeks. Start from month ${startMonth}. Available: 12 months × 4 weeks = 48 slots. Chapters must appear in order. Return ONLY a valid JSON array, no markdown.`
  const userPrompt = `Available months: ${monthList}\n\nChapters:\n${chapterList}\n\nReturn JSON array:\n[{"node_id":"...","month":9,"week_in_month":1},...]`

  let chapterAssignments: { node_id: string; month: number; week_in_month: number }[] = []

  try {
    const result = await withRetry(() =>
      callGemini({ model: QUIZ_MODEL, systemInstruction: systemPrompt, contents: userPrompt, maxOutputTokens: 2048, temperature: 0.2 })
    )
    const cleaned = result.text.replace(/```json|```/g, "").trim()
    chapterAssignments = JSON.parse(cleaned)
  } catch {
    let month = startMonth, week = 1
    for (const ch of chapters) {
      if (week > 4) { week = 1; month = (month % 12) + 1 }
      chapterAssignments.push({ node_id: ch.node_id, month, week_in_month: week })
      week++
    }
  }

  // Build full records: each chapter assignment + cascade to all its descendants
  const seen = new Set<string>()
  const records: { plan_id: string; node_id: string; node_level: string; node_title: string; month: number; week_in_month: number }[] = []

  for (const assignment of chapterAssignments) {
    if (seen.has(assignment.node_id)) continue
    seen.add(assignment.node_id)

    const block = blocks.find(b => b.id === assignment.node_id)
    if (!block) continue

    records.push({
      plan_id: planId,
      node_id: block.id,
      node_level: block.level,
      node_title: block.text,
      month: assignment.month,
      week_in_month: assignment.week_in_month,
    })

    // Cascade to descendants
    const descendants = getDescendants(blocks, block.id)
    for (const d of descendants) {
      if (seen.has(d.id)) continue
      seen.add(d.id)
      records.push({
        plan_id: planId,
        node_id: d.id,
        node_level: d.level,
        node_title: d.text,
        month: assignment.month,
        week_in_month: assignment.week_in_month,
      })
    }
  }

  await supabase.from("pacing_milestones").delete().eq("plan_id", planId)

  const { data: inserted, error } = await supabase
    .from("pacing_milestones")
    .insert(records)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestones: inserted, count: inserted?.length ?? 0 })
}
