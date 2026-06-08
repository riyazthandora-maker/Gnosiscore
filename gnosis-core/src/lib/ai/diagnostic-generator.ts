import { genAI, DIAGNOSTIC_MODEL, withRetry } from "@/lib/ai/gemini"
import type { OverviewStats, TopicStat } from "@/app/api/analytics/route"
import type { TopicStrength, TopicWeakness } from "@/types"

export interface DiagnosticOutput {
  strengths: TopicStrength[]
  weaknesses: TopicWeakness[]
  raw_narrative: string
}

const JSON_SCHEMA = `{
  "strengths": [{ "topic": "string", "confidence_pct": number }],
  "weaknesses": [{ "topic": "string", "error_rate_pct": number, "suggestion": "string" }],
  "raw_narrative": "string"
}`

export async function generateDiagnostic(
  overview: OverviewStats,
  topics: TopicStat[]
): Promise<DiagnosticOutput> {
  if (topics.length === 0) {
    throw new Error("Not enough topic data. Complete more tests first.")
  }

  const performanceSummary = {
    tests_taken:              overview.testsTaken,
    avg_score_pct:            Math.round(overview.avgScore),
    best_score_pct:           Math.round(overview.bestScore),
    overall_accuracy_pct:     Math.round(overview.accuracyPct),
    total_questions_answered: overview.totalAnswered,
    topic_breakdown: topics.map((t) => ({
      topic:          t.topic,
      questions_seen: t.total,
      accuracy_pct:   t.accuracyPct,
    })),
  }

  const model = genAI.getGenerativeModel({
    model: DIAGNOSTIC_MODEL,
    systemInstruction: `You are an educational performance analyst. Output ONLY valid JSON matching this schema:
${JSON_SCHEMA}
Rules:
- strengths: up to 3 topics where accuracy_pct >= 70 and questions_seen >= 3, sorted best first
- weaknesses: up to 3 topics where accuracy_pct < 60 and questions_seen >= 2, worst first
- Each weakness suggestion: one specific, actionable study tip
- raw_narrative: 2-3 sentences, address the student directly, encouraging tone, highlight one strength and one priority`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      temperature: 0.5,
      thinkingConfig: { thinkingBudget: 0 },
    } as any,
  })

  const result = await withRetry(() =>
    model.generateContent(
      `Analyse this student's performance and generate their diagnostic report:\n\n${JSON.stringify(performanceSummary, null, 2)}`
    )
  )

  const text = result.response.text()
  try {
    return JSON.parse(text) as DiagnosticOutput
  } catch {
    const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    return JSON.parse(cleaned) as DiagnosticOutput
  }
}
