import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { QUIZ_MODEL } from "@/lib/ai/gemini"
import type { BlockLevel, FlatBlock } from "@/types/book"

const PER_FILE_MAX = 4 * 1024 * 1024
const BATCH_MAX = 7 * 1024 * 1024

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const SYSTEM_PROMPT = `You are an expert academic curriculum parser and textbook structure specialist.
Analyze the provided extracted text from one or more documents and convert it into a well-structured textbook hierarchy.

STRICT STRUCTURAL RULES:
1. Identify macro topics and map them as "Chapter" nodes.
2. Identify logical sub-topics under each chapter and map them as "Section" nodes.
3. Extract detailed explanations, formulas, definitions, and descriptive facts, mapping them as plain-paragraph "Details" nodes beneath the relevant Section or Chapter.

Output ONLY valid JSON matching this schema — no markdown fences, no extra text:
{
  "chapters": [
    {
      "title": "Chapter Title",
      "sections": [
        {
          "title": "Section Title",
          "details": [
            "Detailed explanatory paragraph or concept note."
          ]
        }
      ],
      "direct_details": [
        "Optional chapter-level summary or introduction paragraph."
      ]
    }
  ]
}`

interface OutlineSection {
  title: string
  details: string[]
}

interface OutlineChapter {
  title: string
  sections?: OutlineSection[]
  direct_details?: string[]
}

function jsonToBlocks(chapters: OutlineChapter[]): FlatBlock[] {
  const blocks: FlatBlock[] = []
  for (const ch of chapters) {
    if (ch.title?.trim()) {
      blocks.push({ id: uid(), level: "chapter" as BlockLevel, text: ch.title.trim() })
    }
    for (const detail of ch.direct_details ?? []) {
      if (detail?.trim()) blocks.push({ id: uid(), level: "details" as BlockLevel, text: detail.trim() })
    }
    for (const sec of ch.sections ?? []) {
      if (sec.title?.trim()) {
        blocks.push({ id: uid(), level: "section" as BlockLevel, text: sec.title.trim() })
      }
      for (const detail of sec.details ?? []) {
        if (detail?.trim()) blocks.push({ id: uid(), level: "details" as BlockLevel, text: detail.trim() })
      }
    }
  }
  return blocks
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Import the internal module directly to avoid pdf-parse loading its test fixture
  // (./test/data/05-versions-space.pdf) on import, which throws ENOENT in Next.js
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default
  const data = await pdfParse(buffer)
  return data.text?.trim() ?? ""
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const fileEntries = formData.getAll("file") as File[]

    if (fileEntries.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    let totalSize = 0
    for (const f of fileEntries) {
      if (f.size > PER_FILE_MAX) {
        return NextResponse.json({ error: `"${f.name}" exceeds the 4 MB per-file limit` }, { status: 400 })
      }
      totalSize += f.size
    }
    if (totalSize > BATCH_MAX) {
      return NextResponse.json({ error: "Total upload exceeds the 7 MB batch limit" }, { status: 400 })
    }

    // Build Gemini content parts: images inline, PDFs as extracted text
    const parts: Record<string, unknown>[] = []
    const pdfTexts: string[] = []

    for (const file of fileEntries) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const mime = file.type
      const name = file.name.toLowerCase()

      if (mime.startsWith("image/")) {
        parts.push({ inline_data: { mime_type: mime, data: bytes.toString("base64") } })
      } else if (mime === "application/pdf" || name.endsWith(".pdf")) {
        const text = await extractPdfText(bytes)
        if (text) pdfTexts.push(`[File: ${file.name}]\n${text.slice(0, 8000)}`)
      }
    }

    if (pdfTexts.length > 0) {
      parts.push({ text: `Extracted document text:\n\n${pdfTexts.join("\n\n---\n\n")}` })
    }

    if (parts.length === 0) {
      return NextResponse.json({ error: "No processable content found in files" }, { status: 400 })
    }

    parts.push({ text: "Analyze the above content and output the structured JSON hierarchy." })

    const apiKey = process.env.GOOGLE_AI_API_KEY!
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${QUIZ_MODEL}:generateContent?key=${apiKey}`

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          maxOutputTokens: 8000,
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    const rawBody = await res.text()
    const sanitized = rawBody.replace(/[\x00-\x1F\x7F]/g, (c) =>
      c === "\n" || c === "\r" || c === "\t" ? " " : ""
    )
    const data = JSON.parse(sanitized) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      error?: { message?: string }
    }

    if (data.error) throw new Error(data.error.message ?? "Gemini error")

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")

    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    const parsed = JSON.parse(clean) as { chapters?: OutlineChapter[] }

    if (!Array.isArray(parsed?.chapters)) throw new Error("AI returned unexpected structure")

    const blocks = jsonToBlocks(parsed.chapters)
    if (blocks.length === 0) throw new Error("No content could be extracted")

    return NextResponse.json({ blocks })
  } catch (err) {
    console.error("[books/ai-import]", err)
    const message = err instanceof Error ? err.message : "Processing failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
