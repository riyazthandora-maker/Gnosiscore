import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini, withRetry, QUIZ_MODEL } from "@/lib/ai/gemini"
import type { BlockLevel, FlatBlock } from "@/types/book"

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const SYSTEM_PROMPT = `You are an expert curriculum designer and academic textbook structure specialist. Your sole job is to generate detailed, well-structured, and comprehensive book/chapter outlines based on user inputs specifying a grade, subject, and chapter/topic.

For every request, adhere strictly to these rules:

1. STRUCTURE:
   - Always output the response starting with bold title: **Chapter: [Chapter Name] ([Grade/Subject Context])**
   - Divide the chapter into logical, sequentially numbered Sections (e.g., 1., 2., 3.).
   - Under each section, provide a detailed bulleted list of essential sub-topics, concepts, properties, and techniques that belong in an academic syllabus.

2. CONTENT QUALITY:
   - Use standard curriculum-aligned terminology (e.g., CBSE, ICSE, Common Core, or state standards depending on the context).
   - Break down broad topics into precise teachable units.
   - Maintain a strictly formal, instructional, and structured tone without conversational fluff or pleasantries before/after the result.

3. FORMAT — output exactly this structure, no deviations:
   **Chapter: [Chapter Title] ([Grade/Subject context])**

   **1. [Section Title]**
   * [Detail point]
   * [Detail point]

   **2. [Section Title]**
   * [Detail point]`

function parseOutline(text: string): FlatBlock[] {
  const blocks: FlatBlock[] = []

  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue

    const chapterMatch = line.match(/^\*\*Chapter:\s*(.+?)\*\*\s*$/)
    if (chapterMatch) {
      blocks.push({ id: uid(), level: "chapter" as BlockLevel, text: chapterMatch[1].trim() })
      continue
    }

    const sectionMatch = line.match(/^\*\*(\d+\..+?)\*\*\s*$/)
    if (sectionMatch) {
      blocks.push({ id: uid(), level: "section" as BlockLevel, text: sectionMatch[1].trim() })
      continue
    }

    const bulletMatch = line.match(/^\*\s+(.+)$/)
    if (bulletMatch) {
      blocks.push({ id: uid(), level: "details" as BlockLevel, text: bulletMatch[1].trim() })
    }
  }

  return blocks
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json() as { prompt?: string }
    const prompt = body.prompt?.trim()
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 })

    const result = await withRetry(() =>
      callGemini({
        model: QUIZ_MODEL,
        systemInstruction: SYSTEM_PROMPT,
        contents: prompt,
        maxOutputTokens: 4000,
        temperature: 0.7,
      })
    )

    const blocks = parseOutline(result.text)
    if (blocks.length === 0) throw new Error("AI returned no parseable content")

    return NextResponse.json({ blocks })
  } catch (err) {
    console.error("[books/ai-outline]", err)
    const message = err instanceof Error ? err.message : "Generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
