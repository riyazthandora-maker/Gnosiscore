import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateQuestionsFromPrompt } from "@/lib/ai/quiz-generator"
import { collectNodeSlices, normalizeWeights, distributeQuestions } from "@/lib/exam/utils"
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
  general_instruction?: string
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

  const { books, selectedNodeIds, weightages, settings, general_instruction } = body
  const { total, easy_pct } = settings

  const selectedSet = new Set(selectedNodeIds)
  const slices = collectNodeSlices(books, selectedSet)

  if (slices.length === 0) {
    return NextResponse.json({ error: "No content selected" }, { status: 400 })
  }

  const normalized = normalizeWeights(weightages, slices.map(s => s.id))
  for (const s of slices) s.weight = normalized[s.id] ?? 0

  const tasks = distributeQuestions(slices, total, easy_pct)

  const results = await Promise.allSettled(
    tasks.map(t => {
      const slice = slices.find(s => s.id === t.nodeId)!
      return generateQuestionsFromPrompt({
        prompt: slice.text,
        difficulty: t.difficulty,
        questionCount: t.count,
        generalInstruction: general_instruction,
      }).then(r => r.questions.map(q => ({ ...q, difficulty: t.difficulty, topic: q.topic || slice.label })))
    })
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
