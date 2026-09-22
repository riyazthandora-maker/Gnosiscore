import { createAdminClient } from "@/lib/supabase/admin"
import { generateQuestionsFromPrompt } from "@/lib/ai/quiz-generator"
import type { DifficultyBands } from "@/types"

interface FlatBlock { id: string; level: string; text: string }

export interface GenerateAutoExamInput {
  planId: string
  milestoneId: string
  nodeId: string
  nodeTitle: string
  teacherId: string
  gradeId: string
  blocks: FlatBlock[]
  questionCount: number
  durationMinutes: number
  difficultyBands: DifficultyBands
}

export interface GenerateAutoExamResult {
  paperId: string
}

function extractNodeText(blocks: FlatBlock[], nodeId: string): string {
  const idx = blocks.findIndex(b => b.id === nodeId)
  if (idx === -1) return ""
  const root = blocks[idx]
  const parts: string[] = [root.text]
  for (let i = idx + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (root.level === "chapter" && b.level === "chapter") break
    if (root.level === "section" && (b.level === "chapter" || b.level === "section")) break
    parts.push(b.text)
  }
  return parts.join("\n\n")
}

function computeSplit(
  avgPct: number | null,
  bands: DifficultyBands,
  total: number,
): { easyCount: number; hardCount: number } {
  if (avgPct === null || avgPct < bands.low[0]) {
    const hard = Math.max(1, Math.floor(total * 0.2))
    return { easyCount: total - hard, hardCount: hard }
  }
  if (avgPct < bands.medium[0]) {
    const hard = Math.round(total * 0.4)
    return { easyCount: total - hard, hardCount: hard }
  }
  if (avgPct < bands.high[0]) {
    const hard = Math.round(total * 0.6)
    return { easyCount: total - hard, hardCount: hard }
  }
  const hard = Math.min(total - 1, Math.round(total * 0.8))
  return { easyCount: total - hard, hardCount: hard }
}

async function getGradeAvgScore(
  admin: ReturnType<typeof createAdminClient>,
  planId: string,
): Promise<number | null> {
  const { data: milestones } = await admin
    .from("pacing_milestones")
    .select("auto_exam_paper_id")
    .eq("plan_id", planId)
    .not("auto_exam_paper_id", "is", null)

  const paperIds = (milestones ?? []).map(m => m.auto_exam_paper_id as string)
  if (!paperIds.length) return null

  const { data: assignments } = await admin
    .from("exam_assignments")
    .select("id")
    .in("paper_id", paperIds)

  const assignmentIds = (assignments ?? []).map(a => a.id as string)
  if (!assignmentIds.length) return null

  const { data: sessions } = await admin
    .from("exam_sessions")
    .select("score, max_score")
    .in("assignment_id", assignmentIds)
    .in("status", ["submitted", "auto_submitted"])
    .not("score", "is", null)
    .not("max_score", "is", null)

  if (!sessions?.length) return null

  const totalPct = sessions.reduce((sum, s) => {
    const pct = ((s.score as number) / (s.max_score as number)) * 100
    return sum + pct
  }, 0)
  return totalPct / sessions.length
}

export async function generateAutoExam(input: GenerateAutoExamInput): Promise<GenerateAutoExamResult> {
  const {
    planId, milestoneId, nodeId, nodeTitle, teacherId,
    blocks, questionCount, durationMinutes, difficultyBands,
  } = input

  const admin = createAdminClient()

  const chapterText = extractNodeText(blocks, nodeId)
  if (!chapterText.trim()) throw new Error(`No text content found for node ${nodeId}`)

  const avgPct = await getGradeAvgScore(admin, planId)
  const { easyCount, hardCount } = computeSplit(avgPct, difficultyBands, questionCount)

  const prompt = `Chapter: ${nodeTitle}\n\n${chapterText}`

  const [easyResult, hardResult] = await Promise.all([
    easyCount > 0
      ? generateQuestionsFromPrompt({ prompt, difficulty: "easy", questionCount: easyCount })
      : Promise.resolve({ questions: [], tokensUsed: 0 }),
    hardCount > 0
      ? generateQuestionsFromPrompt({ prompt, difficulty: "hard", questionCount: hardCount })
      : Promise.resolve({ questions: [], tokensUsed: 0 }),
  ])

  const questions = [
    ...easyResult.questions.slice(0, easyCount),
    ...hardResult.questions.slice(0, hardCount),
  ].map(q => ({
    id: crypto.randomUUID(),
    body: q.body,
    options: q.options,
    correct: q.correct as "A" | "B" | "C" | "D",
    difficulty: (q.difficulty ?? "easy") as "easy" | "hard",
    explanation: q.explanation,
    topic: q.topic,
  }))

  if (!questions.length) throw new Error("No questions generated")

  const { data: paper, error: paperError } = await admin
    .from("exam_papers")
    .insert({
      teacher_id: teacherId,
      title: `Chapter Check: ${nodeTitle}`,
      questions,
      source_meta: {
        type: "auto_assess",
        plan_id: planId,
        node_id: nodeId,
        duration_minutes: durationMinutes,
        easy_count: easyCount,
        hard_count: hardCount,
        avg_pct_used: avgPct,
      },
    })
    .select("id")
    .single()

  if (paperError || !paper) throw new Error(paperError?.message ?? "Failed to create exam paper")

  const { error: milestoneError } = await admin
    .from("pacing_milestones")
    .update({
      auto_exam_paper_id: paper.id,
      auto_exam_status: "pending_review",
    })
    .eq("id", milestoneId)

  if (milestoneError) throw new Error(milestoneError.message)

  return { paperId: paper.id as string }
}
