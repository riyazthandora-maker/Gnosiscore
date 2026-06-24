import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { genAI, QUIZ_MODEL, withRetry } from "@/lib/ai/gemini"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { document_ids } = await request.json() as { document_ids: string[] }
  if (!Array.isArray(document_ids) || document_ids.length === 0) {
    return NextResponse.json({ error: "document_ids is required." }, { status: 400 })
  }

  // Fetch file names for the selected documents
  const { data: docs } = await supabase
    .from("documents")
    .select("file_name, chunk_count")
    .in("id", document_ids)
    .eq("owner_id", user.id)

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: "Documents not found." }, { status: 404 })
  }

  // Fetch a few sample chunks to understand content
  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("content")
    .in("document_id", document_ids)
    .order("chunk_index", { ascending: true })
    .limit(8)

  const sampleContent = (chunks ?? []).map((c) => c.content).join("\n\n").slice(0, 3000)
  const fileNames = docs.map((d) => d.file_name).join(", ")

  const prompt = `You are naming a question bank for an educator. Based on the document names and content below, suggest ONE concise, descriptive name for the question bank (3-6 words). Return ONLY the name, nothing else.

Document names: ${fileNames}
Content sample:
${sampleContent}`

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
