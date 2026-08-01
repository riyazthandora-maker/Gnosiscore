import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { genAI, QUIZ_MODEL, withRetry } from "@/lib/ai/gemini"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { chapter_ids, prompt } = await request.json() as {
    chapter_ids?: string[]
    prompt?: string
  }

  if (!Array.isArray(chapter_ids) || chapter_ids.length === 0) {
    return NextResponse.json({ error: "chapter_ids is required." }, { status: 400 })
  }

  // Verify chapters belong to this user and get their names
  const { data: chapters } = await supabase
    .from("chapters")
    .select("name")
    .in("id", chapter_ids)
    .eq("user_id", user.id)

  if (!chapters || chapters.length === 0) {
    return NextResponse.json({ error: "Chapters not found." }, { status: 404 })
  }

  // Fetch a few document chunk samples from those chapters for context
  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .in("chapter_id", chapter_ids)
    .eq("owner_id", user.id)
    .eq("processing_status", "ready")
    .limit(5)

  const docIds = (docs ?? []).map((d) => d.id)
  let contentSample = ""

  if (docIds.length > 0) {
    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("content")
      .in("document_id", docIds)
      .order("chunk_index", { ascending: true })
      .limit(5)
    contentSample = (chunks ?? []).map((c) => c.content).join("\n\n").slice(0, 2000)
  }

  const chapterNames = chapters.map((c) => c.name).join(", ")
  const promptContext = prompt?.trim() ? `\nCustom prompt: "${prompt}"` : ""

  const input = `You are naming a test for an educator. Based on the chapter names${contentSample ? ", content excerpt," : ""} and optional prompt below, suggest ONE concise, descriptive test name (3-7 words). Return ONLY the name, nothing else.

Chapters: ${chapterNames}${promptContext}${contentSample ? `\nContent sample:\n${contentSample}` : ""}`

  try {
    const response = await withRetry(() =>
      genAI.models.generateContent({
        model: QUIZ_MODEL,
        contents: [{ role: "user", parts: [{ text: input }] }],
      })
    )
    const name = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    return NextResponse.json({ name })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to suggest name."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
