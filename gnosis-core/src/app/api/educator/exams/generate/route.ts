import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateQuestionsFromPrompt } from "@/lib/ai/quiz-generator"
import type { FlatBlock } from "@/types/book"

interface BookPayload {
  id: string
  title: string
  blocks: FlatBlock[]
}

interface GenerateRequest {
  books: BookPayload[]
  selectedNodeIds: string[]
  weightages: Record<string, number>
  settings: { total: number; easy_pct: number }
}

interface NodeSlice {
  id: string
  label: string
  text: string
  weight: number
}

function collectNodeSlices(books: BookPayload[], selectedIds: Set<string>): NodeSlice[] {
  const slices: NodeSlice[] = []

  for (const book of books) {
    const chapters: Array<{
      id: string
      text: string
      sections: Array<{ id: string; text: string }>
      detailsTexts: string[]
    }> = []

    let cur: (typeof chapters)[0] | null = null

    for (const b of book.blocks) {
      if (b.level === "chapter") {
        cur = { id: b.id, text: b.text, sections: [], detailsTexts: [] }
        chapters.push(cur)
      } else if (b.level === "section" && cur) {
        cur.sections.push({ id: b.id, text: b.text })
      } else if (b.level === "details" && cur) {
        cur.detailsTexts.push(b.text)
      }
    }

    // Re-traverse to attach details to sections
    const detailsBySection: Record<string, string[]> = {}
    let curChapterId: string | null = null
    let curSectionId: string | null = null

    for (const b of book.blocks) {
      if (b.level === "chapter") { curChapterId = b.id; curSectionId = null }
      else if (b.level === "section") { curSectionId = b.id }
      else if (b.level === "details") {
        const key = curSectionId ?? curChapterId
        if (key) {
          if (!detailsBySection[key]) detailsBySection[key] = []
          detailsBySection[key].push(b.text)
        }
      }
    }

    for (const ch of chapters) {
      if (ch.sections.length === 0) {
        if (selectedIds.has(ch.id)) {
          const details = detailsBySection[ch.id] ?? []
          slices.push({
            id: ch.id,
            label: ch.text,
            text: [ch.text, ...details].join("\n\n"),
            weight: 0,
          })
        }
      } else {
        for (const s of ch.sections) {
          if (selectedIds.has(s.id)) {
            const details = detailsBySection[s.id] ?? []
            slices.push({
              id: s.id,
              label: s.text,
              text: [ch.text, s.text, ...details].join("\n\n"),
              weight: 0,
            })
          }
        }
      }
    }
  }

  return slices
}

function normalizeWeights(raw: Record<string, number>, ids: string[]): Record<string, number> {
  const total = ids.reduce((sum, id) => sum + (raw[id] ?? 0), 0)
  if (total === 0) {
    const eq = 100 / ids.length
    return Object.fromEntries(ids.map(id => [id, eq]))
  }
  return Object.fromEntries(ids.map(id => [id, ((raw[id] ?? 0) / total) * 100]))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: GenerateRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { books, selectedNodeIds, weightages, settings } = body
  const { total, easy_pct } = settings

  const selectedSet = new Set(selectedNodeIds)
  const slices = collectNodeSlices(books, selectedSet)

  if (slices.length === 0) {
    return NextResponse.json({ error: "No content selected" }, { status: 400 })
  }

  const normalized = normalizeWeights(weightages, slices.map(s => s.id))
  for (const s of slices) s.weight = normalized[s.id] ?? 0

  const easyTotal = Math.round(total * easy_pct / 100)
  const hardTotal = total - easyTotal

  // Distribute question counts across slices by weight
  type Task = { slice: NodeSlice; difficulty: "easy" | "hard"; count: number }
  const tasks: Task[] = []

  let assignedEasy = 0
  let assignedHard = 0

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i]
    const isLast = i === slices.length - 1
    const easyCount = isLast ? easyTotal - assignedEasy : Math.round(easyTotal * s.weight / 100)
    const hardCount = isLast ? hardTotal - assignedHard : Math.round(hardTotal * s.weight / 100)
    assignedEasy += easyCount
    assignedHard += hardCount
    if (easyCount > 0) tasks.push({ slice: s, difficulty: "easy", count: easyCount })
    if (hardCount > 0) tasks.push({ slice: s, difficulty: "hard", count: hardCount })
  }

  const results = await Promise.allSettled(
    tasks.map(t =>
      generateQuestionsFromPrompt({
        prompt: t.slice.text,
        difficulty: t.difficulty,
        questionCount: t.count,
      }).then(r => r.questions.map(q => ({ ...q, difficulty: t.difficulty, topic: q.topic || t.slice.label })))
    )
  )

  const questions = results.flatMap(r => r.status === "fulfilled" ? r.value : [])

  if (questions.length === 0) {
    return NextResponse.json({ error: "Generation failed — no questions produced" }, { status: 500 })
  }

  const withIds = questions.map(q => ({
    id: crypto.randomUUID(),
    body: q.body,
    options: q.options,
    correct: q.correct as "A" | "B" | "C" | "D",
    difficulty: (q.difficulty ?? "easy") as "easy" | "hard",
    explanation: q.explanation,
    topic: q.topic,
  }))

  return NextResponse.json({ questions: withIds })
}
