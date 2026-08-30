import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini, withRetry, QUIZ_MODEL } from "@/lib/ai/gemini"
import type { ExamQuestion } from "@/types"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { questions }: { questions: ExamQuestion[] } = await request.json()

  if (!questions?.length) {
    return NextResponse.json({ error: "No questions provided" }, { status: 400 })
  }

  // Build a compact topic list for the prompt
  const topics = [...new Set(questions.map(q => q.topic).filter(Boolean))].slice(0, 10).join(", ")
  const prompt = `Topics covered: ${topics}\nNumber of questions: ${questions.length}`

  const { text } = await withRetry(() =>
    callGemini({
      model: QUIZ_MODEL,
      systemInstruction:
        "You are a title generator for academic exam papers. " +
        "Given a list of topics, output ONLY a concise exam title (4-8 words, title case). " +
        "No quotes, no punctuation at the end, no explanation.",
      contents: prompt,
      maxOutputTokens: 32,
      temperature: 0.7,
    })
  )

  const title = text.trim().replace(/^["']|["']$/g, "")
  return NextResponse.json({ title })
}
