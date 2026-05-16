import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import type { Toughness } from "@/types"

const client = new Anthropic()

interface GeneratedQuestion {
  body: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  topic: string
}

interface GenerateOptions {
  documentId: string
  toughness: Toughness
  totalQuestions: number
  topicFilter?: string[] | null
}

const DIFFICULTY_GUIDANCE: Record<Toughness, string> = {
  easy: "basic recall and simple comprehension. Questions should be straightforward with clearly wrong distractors.",
  medium: "application and understanding. Questions should require interpreting concepts, not just recalling them.",
  hard: "analysis and synthesis. Questions should require comparing ideas, spotting nuances, or combining multiple concepts.",
  advanced: "evaluation and expert-level reasoning. Questions should challenge assumptions, involve edge cases, or require deep domain knowledge.",
}

export async function generateQuestions(opts: GenerateOptions): Promise<GeneratedQuestion[]> {
  const { documentId, toughness, totalQuestions, topicFilter } = opts

  // Download markdown from Supabase Storage
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("documents")
    .select("markdown_path, title")
    .eq("id", documentId)
    .single()

  if (!doc?.markdown_path) throw new Error("Document markdown not ready.")

  const { data: fileData, error: dlErr } = await supabase.storage
    .from("documents")
    .download(doc.markdown_path)

  if (dlErr || !fileData) throw new Error("Failed to download document content.")

  const markdownContent = await fileData.text()

  const topicInstruction = topicFilter?.length
    ? ` Focus exclusively on these topics: ${topicFilter.join(", ")}.`
    : ""

  const schema = `{"questions":[{"body":"string","options":{"A":"string","B":"string","C":"string","D":"string"},"correct":"A"|"B"|"C"|"D","explanation":"string","topic":"string"}]}`

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: Math.min(totalQuestions * 250, 8000),
    system: `You are an expert educational quiz generator. Output ONLY valid JSON matching this exact schema — no markdown fences, no extra text:
${schema}
Rules:
- Generate exactly ${totalQuestions} questions
- Each question must have exactly 4 options (A, B, C, D) with exactly one correct answer
- Difficulty: ${DIFFICULTY_GUIDANCE[toughness]}
- Explanations must be concise (1-2 sentences) and educational
- topic field: a short noun phrase identifying the concept tested`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            cache_control: { type: "ephemeral" },
            text: `<study_material title="${doc.title}">\n${markdownContent}\n</study_material>`,
          },
          {
            type: "text",
            text: `Generate exactly ${totalQuestions} ${toughness}-level multiple-choice questions from the study material above.${topicInstruction}`,
          },
        ],
      },
    ],
  })

  const raw = message.content[0].type === "text" ? message.content[0].text : ""

  let parsed: { questions: GeneratedQuestion[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Strip possible markdown fences if model misbehaves
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    parsed = JSON.parse(cleaned)
  }

  if (!Array.isArray(parsed.questions)) throw new Error("Unexpected AI response structure.")

  return parsed.questions.slice(0, totalQuestions)
}
