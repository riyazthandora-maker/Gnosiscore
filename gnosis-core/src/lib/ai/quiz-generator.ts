import { genAI, QUIZ_MODEL, withRetry } from "@/lib/ai/gemini"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Difficulty } from "@/types"
import { RAG_SIMILARITY_THRESHOLD } from "@/types"

export class RAGThresholdError extends Error {
  constructor() {
    super(
      "No document content matched the query with sufficient relevance (threshold: 72%). " +
      "Try a different topic or upload more specific material."
    )
    this.name = "RAGThresholdError"
  }
}

export interface GeneratedQuestion {
  body: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  topic: string
}

export interface GenerateOptions {
  documentIds: string[]
  difficulty: Difficulty
  questionCount: number
  topic?: string
  supabase: SupabaseClient
}

export interface GenerateFromPromptOptions {
  prompt: string
  difficulty: Difficulty
  questionCount: number
}

export interface GenerateResult {
  questions: GeneratedQuestion[]
  tokensUsed: number
}

const DIFFICULTY_GUIDANCE: Record<Difficulty, string> = {
  easy:   "basic recall and simple comprehension — straightforward questions with clearly wrong distractors",
  medium: "application and interpretation — requires understanding concepts, not just recalling them",
  hard:   "analysis and synthesis — comparing ideas, spotting nuances, combining multiple concepts",
}

export async function embedQuery(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" })
  const result = await withRetry(() =>
    model.embedContent({
      content: { parts: [{ text }], role: "user" },
      taskType: "RETRIEVAL_QUERY" as never,
      outputDimensionality: 768,
    } as never)
  )
  return result.embedding.values
}

export async function generateQuestions(opts: GenerateOptions): Promise<GenerateResult> {
  const { documentIds, difficulty, questionCount, topic, supabase } = opts

  // 1. Embed topic for semantic retrieval
  const queryText = topic?.trim() || "important concepts and key facts"
  const embedding = await embedQuery(queryText)

  // 2. RAG: retrieve relevant chunks above similarity threshold
  const { data: chunks, error: ragErr } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    document_ids: documentIds,
    similarity_threshold: RAG_SIMILARITY_THRESHOLD,
    match_count: 20,
  })

  if (ragErr) throw new Error(`RAG search failed: ${ragErr.message}`)
  if (!chunks || (chunks as unknown[]).length === 0) throw new RAGThresholdError()

  // 3. Build context from retrieved chunks
  const context = (chunks as { content: string; similarity: number }[])
    .map((c, i) => `[Excerpt ${i + 1} | relevance ${(c.similarity * 100).toFixed(0)}%]\n${c.content}`)
    .join("\n\n---\n\n")

  const topicInstruction = topic?.trim()
    ? ` Focus exclusively on the topic: "${topic}".`
    : ""

  // 4. Generate with Gemini
  const model = genAI.getGenerativeModel({
    model: QUIZ_MODEL,
    systemInstruction: `You are an expert educational quiz generator. Output ONLY valid JSON — no markdown fences, no extra text.

Schema:
{
  "questions": [
    {
      "body": "question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "A",
      "explanation": "why A is correct",
      "topic": "concept name"
    }
  ]
}

Rules:
- Generate exactly ${questionCount} questions at ${difficulty} difficulty: ${DIFFICULTY_GUIDANCE[difficulty]}
- Base ALL questions strictly on the provided excerpts — never invent facts not present in the excerpts
- Each question must have exactly 4 options (A, B, C, D) with exactly one correct answer
- correct must be exactly "A", "B", "C", or "D"
- Explanations: 1-2 sentences, educational
- topic: short noun phrase identifying the concept tested`,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: Math.min(questionCount * 600, 8000),
      temperature: 0.7,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinkingConfig: { thinkingBudget: 0 },
    } as never,
  })

  const result = await withRetry(() =>
    model.generateContent(
      `<excerpts>\n${context}\n</excerpts>\n\nGenerate exactly ${questionCount} ${difficulty}-level multiple-choice questions from the excerpts above.${topicInstruction}`
    )
  )

  const text = result.response.text()
  const meta = result.response.usageMetadata as { totalTokenCount?: number } | undefined
  const tokensUsed = meta?.totalTokenCount ?? 0

  let parsed: { questions: GeneratedQuestion[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    parsed = JSON.parse(cleaned)
  }

  if (!Array.isArray(parsed.questions)) throw new Error("Unexpected response structure from AI.")
  return { questions: parsed.questions.slice(0, questionCount), tokensUsed }
}

function buildQuizModel(questionCount: number, difficulty: Difficulty) {
  return genAI.getGenerativeModel({
    model: QUIZ_MODEL,
    systemInstruction: `You are an expert educational quiz generator. Output ONLY valid JSON — no markdown fences, no extra text.

Schema:
{
  "questions": [
    {
      "body": "question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "A",
      "explanation": "why A is correct",
      "topic": "concept name"
    }
  ]
}

Rules:
- Generate exactly ${questionCount} questions at ${difficulty} difficulty: ${DIFFICULTY_GUIDANCE[difficulty]}
- Each question must have exactly 4 options (A, B, C, D) with exactly one correct answer
- correct must be exactly "A", "B", "C", or "D"
- Explanations: 1-2 sentences, educational
- topic: short noun phrase identifying the concept tested`,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: Math.min(questionCount * 600, 8000),
      temperature: 0.7,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinkingConfig: { thinkingBudget: 0 },
    } as never,
  })
}

export async function generateQuestionsFromPrompt(opts: GenerateFromPromptOptions): Promise<GenerateResult> {
  const { prompt, difficulty, questionCount } = opts

  const model = buildQuizModel(questionCount, difficulty)

  const result = await withRetry(() =>
    model.generateContent(
      `Generate exactly ${questionCount} ${difficulty}-level multiple-choice questions about:\n\n${prompt}`
    )
  )

  const text = result.response.text()
  const meta = result.response.usageMetadata as { totalTokenCount?: number } | undefined
  const tokensUsed = meta?.totalTokenCount ?? 0

  let parsed: { questions: GeneratedQuestion[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    parsed = JSON.parse(cleaned)
  }

  if (!Array.isArray(parsed.questions)) throw new Error("Unexpected response structure from AI.")
  return { questions: parsed.questions.slice(0, questionCount), tokensUsed }
}
