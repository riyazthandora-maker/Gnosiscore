import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callGemini, withRetry, QUIZ_MODEL } from "@/lib/ai/gemini"
import type { BlockLevel } from "@/types/book"

// ── System prompts per level ──────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<BlockLevel, string> = {
  chapter: `You are an expert educational content author. Given a chapter title and optional instructions, generate a structured chapter outline as an ordered flat list of sections and key concept notes.

Output ONLY valid JSON with this exact schema — no markdown fences, no extra text:
{
  "blocks": [
    { "level": "section" | "concept", "text": "..." }
  ]
}

Rules:
- Generate 3–5 sections (level: "section") with clear, descriptive titles
- Under each section add 2–4 key concept blocks (level: "concept")
- Maintain strict reading order: [section → its concepts → next section → its concepts → ...]
- For STEM subjects: include definitions, formulas (plain text), and worked-example hints as concept notes
- For humanities and social sciences: include rich narrative detail — key dates, historical figures, causes and effects, definitions — not just bare titles
- Concept text must be 1–3 substantive educational sentences, never a one-word heading
- CRITICAL JSON RULE: Every string value must be on a single line with no literal newlines or control characters inside it`,

  section: `You are an expert educational content author. Expand a textbook section with detailed key concept notes.

Output ONLY valid JSON — no markdown fences, no extra text:
{
  "blocks": [
    { "level": "concept", "text": "..." }
  ]
}

Rules:
- Generate 4–6 concept blocks (all level: "concept")
- For STEM: include definitions, formulas, derivation hints, and worked examples
- For humanities and social sciences: write narrative paragraphs that include specific names, dates, causes, effects, and historical significance
- Each concept block must be 2–4 informative sentences — never a bare heading
- CRITICAL JSON RULE: Every string value must be on a single line with no literal newlines or control characters inside it`,

  concept: `You are an expert educational content author. Expand a single key concept into a rich set of educational detail notes.

Output ONLY valid JSON — no markdown fences, no extra text:
{
  "blocks": [
    { "level": "concept", "text": "..." }
  ]
}

Rules:
- Generate 2–4 concept blocks (all level: "concept")
- First block: extended definition or main explanation (3–5 sentences)
- Subsequent blocks: worked examples, historical context, real-world applications, analogies, or common misconceptions
- For social science topics: include specific dates, people, places, and consequences
- For STEM: include formula context, a worked example, and common misconceptions
- CRITICAL JSON RULE: Every string value must be on a single line with no literal newlines or control characters inside it`,
}

const MAX_TOKENS: Record<BlockLevel, number> = {
  chapter: 3000,
  section: 2000,
  concept: 1500,
}

// ── Gemini call with optional image parts ─────────────────────────────────────

async function callGeminiWithContext(
  level: BlockLevel,
  userMessage: string,
): Promise<{ level: BlockLevel; text: string }[]> {
  const result = await withRetry(() =>
    callGemini({
      model: QUIZ_MODEL,
      systemInstruction: SYSTEM_PROMPTS[level],
      contents: userMessage,
      maxOutputTokens: MAX_TOKENS[level],
      temperature: 0.8,
    })
  )

  const raw = result.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
  const parsed = JSON.parse(raw) as { blocks: { level: BlockLevel; text: string }[] }

  if (!Array.isArray(parsed?.blocks)) throw new Error("Unexpected AI response structure.")

  return parsed.blocks.filter(
    (b) => (b.level === "section" || b.level === "concept") && typeof b.text === "string" && b.text.trim()
  )
}

// ── Vision call for image files ───────────────────────────────────────────────

async function callGeminiWithImage(
  level: BlockLevel,
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<{ level: BlockLevel; text: string }[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${QUIZ_MODEL}:generateContent?key=${apiKey}`

  const userText = prompt.trim()
    ? `Using the content in this image as source material, generate educational book blocks. Additional instructions: ${prompt}`
    : `Using the content in this image as source material, generate educational book blocks.`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: userText },
        ],
      }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPTS[level] }] },
      generationConfig: {
        maxOutputTokens: MAX_TOKENS[level],
        temperature: 0.8,
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

  if (data.error) throw new Error(data.error.message ?? "Gemini vision error")

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")

  const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
  const parsed = JSON.parse(clean) as { blocks: { level: BlockLevel; text: string }[] }

  if (!Array.isArray(parsed?.blocks)) throw new Error("Unexpected AI response structure.")

  return parsed.blocks.filter(
    (b) => (b.level === "section" || b.level === "concept") && typeof b.text === "string" && b.text.trim()
  )
}

// ── Extract text from PDF buffer ──────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default
  const data = await pdfParse(buffer)
  return data.text?.trim() ?? ""
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const contentType = req.headers.get("content-type") ?? ""
    let blockLevel: BlockLevel
    let blockText: string
    let prompt: string
    let fileBytes: Buffer | null = null
    let fileMime: string | null = null
    let fileName: string | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      blockLevel = (formData.get("blockLevel") as BlockLevel) ?? "chapter"
      blockText = (formData.get("blockText") as string) ?? ""
      prompt = (formData.get("prompt") as string) ?? ""
      const file = formData.get("file") as File | null
      if (file) {
        fileBytes = Buffer.from(await file.arrayBuffer())
        fileMime = file.type
        fileName = file.name
      }
    } else {
      const body = await req.json() as {
        blockLevel?: BlockLevel
        blockText?: string
        prompt?: string
        bookTitle?: string
      }
      blockLevel = body.blockLevel ?? "chapter"
      blockText = body.blockText ?? ""
      prompt = body.prompt ?? ""
    }

    // Validate level
    if (!["chapter", "section", "concept"].includes(blockLevel)) {
      return NextResponse.json({ error: "Invalid blockLevel" }, { status: 400 })
    }

    let blocks: { level: BlockLevel; text: string }[]

    if (fileBytes && fileMime) {
      const isImage = fileMime.startsWith("image/")
      const isPdf = fileMime === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf")

      if (isImage) {
        const imageBase64 = fileBytes.toString("base64")
        blocks = await callGeminiWithImage(blockLevel, imageBase64, fileMime, prompt)
      } else {
        // PDF or text file — extract text
        let extractedText = ""
        if (isPdf) {
          extractedText = await extractPdfText(fileBytes)
        } else {
          extractedText = fileBytes.toString("utf-8")
        }

        const userMessage = buildUserMessage(blockLevel, blockText, prompt, extractedText)
        blocks = await callGeminiWithContext(blockLevel, userMessage)
      }
    } else {
      const userMessage = buildUserMessage(blockLevel, blockText, prompt, null)
      blocks = await callGeminiWithContext(blockLevel, userMessage)
    }

    return NextResponse.json({ blocks })
  } catch (err) {
    console.error("[books/generate]", err)
    const message = err instanceof Error ? err.message : "Generation failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── Build the user message for text-only calls ────────────────────────────────

function buildUserMessage(
  level: BlockLevel,
  blockText: string,
  prompt: string,
  fileContent: string | null,
): string {
  const parts: string[] = []

  if (blockText.trim()) {
    const label = level === "chapter" ? "Chapter" : level === "section" ? "Section" : "Concept"
    parts.push(`${label}: "${blockText.trim()}"`)
  }

  if (prompt.trim()) {
    parts.push(`Instructions: ${prompt.trim()}`)
  }

  if (fileContent) {
    const excerpt = fileContent.slice(0, 6000)
    parts.push(`Source material:\n${excerpt}`)
  }

  if (parts.length === 0) {
    parts.push(`Generate educational content at the ${level} level.`)
  }

  return parts.join("\n\n")
}
