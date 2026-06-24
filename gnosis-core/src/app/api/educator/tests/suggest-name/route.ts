import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { genAI, QUIZ_MODEL, withRetry } from "@/lib/ai/gemini"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as {
    question_ids?: string[]
    generation_request_ids?: string[]
  }

  let topics: string[] = []
  let questionTexts: string[] = []

  if (Array.isArray(body.question_ids) && body.question_ids.length > 0) {
    const { data: questions } = await supabase
      .from("questions")
      .select("question_text, topic_tags, difficulty")
      .in("id", body.question_ids)
      .eq("owner_id", user.id)
      .limit(20)

    for (const q of questions ?? []) {
      topics.push(...(q.topic_tags ?? []))
      questionTexts.push(q.question_text)
    }
  } else if (Array.isArray(body.generation_request_ids) && body.generation_request_ids.length > 0) {
    // For composite test — get questions from selected banks
    const { data: questions } = await supabase
      .from("questions")
      .select("question_text, topic_tags")
      .in("generation_request_id", body.generation_request_ids)
      .eq("owner_id", user.id)
      .eq("status", "approved")
      .limit(20)

    for (const q of questions ?? []) {
      topics.push(...(q.topic_tags ?? []))
      questionTexts.push(q.question_text)
    }
  } else {
    return NextResponse.json({ error: "Provide question_ids or generation_request_ids." }, { status: 400 })
  }

  if (questionTexts.length === 0) {
    return NextResponse.json({ error: "No questions found." }, { status: 404 })
  }

  const uniqueTopics = [...new Set(topics)].slice(0, 10)
  const sampleQuestions = questionTexts.slice(0, 5).join("\n")

  const prompt = `You are naming a test for an educator. Based on the topics and sample questions below, suggest ONE unique, concise test name (3-7 words). The name should reflect the subject matter and be appropriate for a quiz. Return ONLY the name, nothing else.

Topics: ${uniqueTopics.join(", ") || "General"}
Sample questions:
${sampleQuestions}`

  try {
    const response = await withRetry(() =>
      genAI.models.generateContent({
        model: QUIZ_MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      })
    )
    const name = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    return NextResponse.json({ name })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to suggest name."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
