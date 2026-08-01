import { genAI, QUIZ_MODEL, withRetry } from "@/lib/ai/gemini"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Difficulty } from "@/types"

export interface GenerateBlendedOptions {
  chapterDocIds: string[]
  prompt: string
  promptPct: number     // 0-100
  easyCount: number
  mediumCount: number
  hardCount: number
  supabase: SupabaseClient
}

export interface GeneratedQuestion {
  body: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  difficulty?: "easy" | "medium" | "hard"
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

  // 2. RAG: retrieve top-N chunks scaled to question count
  const semanticCount = Math.min(questionCount * 3, 80)
  const { data: semanticChunks, error: ragErr } = await supabase.rpc("match_chunks", {
    query_embedding: `[${embedding.join(",")}]`,
    document_ids: documentIds,
    similarity_threshold: 0,
    match_count: semanticCount,
  })

  if (ragErr) throw new Error(`RAG search failed: ${ragErr.message}`)
  if (!semanticChunks || (semanticChunks as unknown[]).length === 0) {
    throw new Error("No content found for this document. Please re-upload and process it.")
  }

  // 3. Merge semantic results with spread-sampled chunks for full coverage
  const spreadChunks = await spreadSampleChunks(documentIds, Math.min(questionCount, 20), supabase)
  const combined = mergeChunks(semanticChunks as { content: string }[], spreadChunks)

  const context = combined
    .map((c, i) => `[Excerpt ${i + 1}]\n${c.content}`)
    .join("\n\n---\n\n")

  const topicInstruction = topic?.trim()
    ? ` Focus exclusively on the topic: "${topic}".`
    : ""

  // 4. Generate with Gemini
  const result = await withRetry(() =>
    genAI.models.generateContent({
      model: QUIZ_MODEL,
      contents: `<excerpts>\n${context}\n</excerpts>\n\nGenerate exactly ${questionCount} ${difficulty}-level multiple-choice questions from the excerpts above. Spread questions evenly across all provided excerpts — do not focus on a single section.${topicInstruction}`,
      config: {
        systemInstruction: `You are an expert educational quiz generator. Output ONLY valid JSON — no markdown fences, no extra text.

Schema:
{
  "questions": [
    {
      "body": "question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "<A|B|C|D>",
      "difficulty": "<easy|medium|hard>",
      "explanation": "why the correct answer is right",
      "topic": "concept name"
    }
  ]
}

Rules:
- Generate exactly ${questionCount} questions at ${difficulty} difficulty: ${DIFFICULTY_GUIDANCE[difficulty]}
- Base ALL questions strictly on the provided excerpts — never invent facts not present in the excerpts
- Each question must have exactly 4 options (A, B, C, D) with exactly one correct answer
- correct must be exactly "A", "B", "C", or "D"
- Vary the correct answer position — distribute roughly equally across A, B, C, and D across all questions
- difficulty must be "easy" or "hard" matching the difficulty level of this question
- Explanations: 1-2 sentences, educational
- topic: short noun phrase identifying the concept tested`,
        responseMimeType: "application/json",
        maxOutputTokens: Math.min(questionCount * 600, 8000),
        temperature: 0.9,
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

function difficultyInstruction(easy: number, medium: number, hard: number): string {
  const parts: string[] = []
  if (easy > 0)   parts.push(`exactly ${easy} easy (simple recall and recognition)`)
  if (medium > 0) parts.push(`exactly ${medium} medium (application and interpretation)`)
  if (hard > 0)   parts.push(`exactly ${hard} hard (analysis and synthesis)`)
  return parts.join(", ")
}

function scaleDifficulty(
  easy: number, medium: number, hard: number,
  batchCount: number, totalCount: number
): [number, number, number] {
  if (totalCount === 0 || batchCount === 0) return [0, 0, 0]
  const e = Math.round(easy * batchCount / totalCount)
  const m = Math.round(medium * batchCount / totalCount)
  return [e, m, Math.max(0, batchCount - e - m)]
}

function toughnessToDifficulty(toughness: number): Difficulty {
  if (toughness < 34) return "easy"
  if (toughness >= 67) return "hard"
  return "medium"
}

function buildBlendedSystemPrompt(count: number, diffInstruction: string): string {
  return `You are an expert educational quiz generator. Output ONLY valid JSON — no markdown fences, no extra text.

Schema:
{
  "questions": [
    {
      "body": "question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "<A|B|C|D>",
      "difficulty": "<easy|medium|hard>",
      "explanation": "why the correct answer is right",
      "topic": "concept name"
    }
  ]
}

Rules:
- Generate exactly ${count} questions, ${diffInstruction}
- Each question must have exactly 4 options (A, B, C, D) with exactly one correct answer
- correct must be exactly "A", "B", "C", or "D"
- Vary the correct answer position — distribute roughly equally across A, B, C, and D across all questions
- difficulty must be "easy", "medium", or "hard" matching the type assigned to this question
- Explanations: 1-2 sentences, educational
- topic: short noun phrase identifying the concept tested`
}

function parseQuestions(text: string): GeneratedQuestion[] {
  let parsed: { questions: GeneratedQuestion[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    parsed = JSON.parse(cleaned)
  }
  if (!Array.isArray(parsed.questions)) throw new Error("Unexpected response structure from AI.")
  return parsed.questions
}

async function fetchAllChunksOrdered(
  documentIds: string[],
  supabase: SupabaseClient
): Promise<{ content: string }[]> {
  const { data } = await supabase
    .from("document_chunks")
    .select("content, chunk_index")
    .in("document_id", documentIds)
    .order("chunk_index", { ascending: true })
  return data ?? []
}

function groupChunks(chunks: { content: string }[], groupCount: number): { content: string }[][] {
  const actual = Math.min(groupCount, chunks.length)
  const size = Math.ceil(chunks.length / actual)
  const groups: { content: string }[][] = []
  for (let i = 0; i < chunks.length; i += size) {
    groups.push(chunks.slice(i, i + size))
  }
  return groups
}

function allocateQuestions(total: number, groupCount: number): number[] {
  const base = Math.floor(total / groupCount)
  const remainder = total % groupCount
  return Array.from({ length: groupCount }, (_, i) => base + (i < remainder ? 1 : 0))
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function generateFromBatches(
  chunks: { content: string }[],
  docCount: number,
  easy: number,
  medium: number,
  hard: number,
  focusLine: string
): Promise<{ questions: GeneratedQuestion[]; tokens: number }> {
  // Aim for ~5 questions per batch, max 10 batches
  const batchCount = Math.min(Math.ceil(docCount / 5), 10)
  const groups = groupChunks(chunks, batchCount)
  const qCounts = allocateQuestions(docCount, groups.length)

  let usedEasy = 0, usedMed = 0

  const batchResults = await Promise.all(
    groups.map((group, i) => {
      const q = qCounts[i]
      const isLast = i === groups.length - 1
      let bE: number, bM: number, bH: number
      if (isLast) {
        bE = Math.max(0, easy - usedEasy)
        bM = Math.max(0, medium - usedMed)
        bH = Math.max(0, q - bE - bM)
      } else {
        ;[bE, bM, bH] = scaleDifficulty(easy, medium, hard, q, docCount)
        usedEasy += bE
        usedMed += bM
      }

      const context = group
        .map((c, idx) => `[Excerpt ${idx + 1}]\n${c.content}`)
        .join("\n\n---\n\n")
      const diffInstruction = difficultyInstruction(bE, bM, bH)

      return withRetry(() =>
        genAI.models.generateContent({
          model: QUIZ_MODEL,
          contents: `<excerpts>\n${context}\n</excerpts>\n\nGenerate exactly ${q} multiple-choice questions from these excerpts.${focusLine}`,
          config: {
            systemInstruction: buildBlendedSystemPrompt(q, diffInstruction),
            responseMimeType: "application/json",
            maxOutputTokens: Math.min(q * 600, 4000),
            temperature: 0.9,
            thinkingConfig: { thinkingBudget: 0 },
          },
        })
      )
    })
  )

  let questions: GeneratedQuestion[] = []
  let tokens = 0
  for (const result of batchResults) {
    questions = [...questions, ...parseQuestions(result.text ?? "")]
    tokens += result.usageMetadata?.totalTokenCount ?? 0
  }

  return { questions: shuffleArray(questions).slice(0, docCount), tokens }
}

export async function generateBlended(opts: GenerateBlendedOptions): Promise<GenerateResult> {
  const { chapterDocIds, prompt, promptPct, easyCount, mediumCount, hardCount, supabase } = opts

  const totalCount = easyCount + mediumCount + hardCount
  const promptCount = Math.round(totalCount * promptPct / 100)
  const docCount = totalCount - promptCount

  const [docEasy, docMed, docHard] = scaleDifficulty(easyCount, mediumCount, hardCount, docCount, totalCount)
  const [prmEasy, prmMed, prmHard] = [easyCount - docEasy, mediumCount - docMed, hardCount - docHard]

  let allQuestions: GeneratedQuestion[] = []
  let totalTokens = 0

  // ── Document-sourced questions via batched parallel generation ──
  if (docCount > 0 && chapterDocIds.length > 0) {
    const chunks = await fetchAllChunksOrdered(chapterDocIds, supabase)
    if (chunks.length === 0) {
      throw new Error(
        "No processed content found in the selected chapters. Ensure all documents have finished processing."
      )
    }
    const focusLine = prompt.trim() ? ` Focus on: "${prompt}".` : ""
    const { questions, tokens } = await generateFromBatches(chunks, docCount, docEasy, docMed, docHard, focusLine)
    allQuestions = [...allQuestions, ...questions]
    totalTokens += tokens
  }

  // ── Prompt-only questions ───────────────────────────────────────
  if (promptCount > 0 && prompt.trim()) {
    const diffInstruction = difficultyInstruction(prmEasy, prmMed, prmHard)
    const result = await withRetry(() =>
      genAI.models.generateContent({
        model: QUIZ_MODEL,
        contents: `Generate exactly ${promptCount} multiple-choice questions about:\n\n${prompt}`,
        config: {
          systemInstruction: buildBlendedSystemPrompt(promptCount, diffInstruction),
          responseMimeType: "application/json",
          maxOutputTokens: Math.min(promptCount * 600, 8000),
          temperature: 0.9,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    )

    allQuestions = [...allQuestions, ...parseQuestions(result.text ?? "").slice(0, promptCount)]
    totalTokens += result.usageMetadata?.totalTokenCount ?? 0
  }

  return { questions: allQuestions.slice(0, totalCount), tokensUsed: totalTokens }
}

export { toughnessToDifficulty }

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
      "correct": "<A|B|C|D>",
      "difficulty": "<easy|medium|hard>",
      "explanation": "why the correct answer is right",
      "topic": "concept name"
    }
  ]
}

Rules:
- Generate exactly ${questionCount} questions at ${difficulty} difficulty: ${DIFFICULTY_GUIDANCE[difficulty]}
- Each question must have exactly 4 options (A, B, C, D) with exactly one correct answer
- correct must be exactly "A", "B", "C", or "D"
- Vary the correct answer position — distribute roughly equally across A, B, C, and D across all questions
- difficulty must be "easy" or "hard" matching the difficulty level of this question
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
