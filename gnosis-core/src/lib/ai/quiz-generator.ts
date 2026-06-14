import { genAI, QUIZ_MODEL, withRetry } from "@/lib/ai/gemini"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Difficulty } from "@/types"

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
  const result = await withRetry(() =>
    genAI.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 },
    })
  )
  return result.embeddings?.[0]?.values ?? []
}

export async function generateQuestions(opts: GenerateOptions): Promise<GenerateResult> {
  const { documentIds, difficulty, questionCount, topic, supabase } = opts

  // 1. Embed topic for semantic retrieval
  const queryText = topic?.trim() || "important concepts and key facts"
  const embedding = await embedQuery(queryText)

  // 2. RAG: retrieve top-N chunks regardless of similarity score
  // PostgREST cannot cast a JS number[] to vector(768) automatically — pass as pgvector string.
  const { data: chunks, error: ragErr } = await supabase.rpc("match_chunks", {
    query_embedding: `[${embedding.join(",")}]`,
    document_ids: documentIds,
    similarity_threshold: 0,
    match_count: 20,
  })

  if (ragErr) throw new Error(`RAG search failed: ${ragErr.message}`)
  if (!chunks || (chunks as unknown[]).length === 0) {
    throw new Error("No content found for this document. Please re-upload and process it.")
  }

  // 3. Build context from retrieved chunks
  const context = (chunks as { content: string; similarity: number }[])
    .map((c, i) => `[Excerpt ${i + 1} | relevance ${(c.similarity * 100).toFixed(0)}%]\n${c.content}`)
    .join("\n\n---\n\n")

  const topicInstruction = topic?.trim()
    ? ` Focus exclusively on the topic: "${topic}".`
    : ""

  // 4. Generate with Gemini
  const result = await withRetry(() =>
    genAI.models.generateContent({
      model: QUIZ_MODEL,
      contents: `<excerpts>\n${context}\n</excerpts>\n\nGenerate exactly ${questionCount} ${difficulty}-level multiple-choice questions from the excerpts above.${topicInstruction}`,
      config: {
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
        responseMimeType: "application/json",
        maxOutputTokens: Math.min(questionCount * 600, 8000),
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
  )

  const text = result.text ?? ""
  const tokensUsed = result.usageMetadata?.totalTokenCount ?? 0

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

export async function generateQuestionsFromPrompt(opts: GenerateFromPromptOptions): Promise<GenerateResult> {
  const { prompt, difficulty, questionCount } = opts

  const result = await withRetry(() =>
    genAI.models.generateContent({
      model: QUIZ_MODEL,
      contents: `Generate exactly ${questionCount} ${difficulty}-level multiple-choice questions about:\n\n${prompt}`,
      config: {
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
        responseMimeType: "application/json",
        maxOutputTokens: Math.min(questionCount * 600, 8000),
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
  )

  const text = result.text ?? ""
  const tokensUsed = result.usageMetadata?.totalTokenCount ?? 0

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
