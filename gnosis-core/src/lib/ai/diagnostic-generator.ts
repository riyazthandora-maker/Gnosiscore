import Anthropic from "@anthropic-ai/sdk"
import type { OverviewStats, TopicStat } from "@/app/api/analytics/route"
import type { TopicStrength, TopicWeakness } from "@/types"

const client = new Anthropic()

export interface DiagnosticOutput {
  strengths: TopicStrength[]
  weaknesses: TopicWeakness[]
  raw_narrative: string
}

const SCHEMA = `{
  "strengths": [{"topic": "string", "confidence_pct": number}],
  "weaknesses": [{"topic": "string", "error_rate_pct": number, "suggestion": "string"}],
  "raw_narrative": "string (2-3 sentences, personalized, encouraging)"
}`

export async function generateDiagnostic(
  overview: OverviewStats,
  topics: TopicStat[]
): Promise<DiagnosticOutput> {
  if (topics.length === 0) {
    throw new Error("Not enough topic data to generate a diagnostic report. Complete more tests first.")
  }

  const performanceSummary = {
    tests_taken: overview.testsTaken,
    avg_score_pct: Math.round(overview.avgScore),
    best_score_pct: Math.round(overview.bestScore),
    overall_accuracy_pct: Math.round(overview.accuracyPct),
    total_questions_answered: overview.totalAnswered,
    topic_breakdown: topics.map((t) => ({
      topic: t.topic,
      questions_seen: t.total,
      accuracy_pct: t.accuracyPct,
    })),
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are an educational performance analyst. Analyse a student's quiz data and output ONLY valid JSON matching this schema — no markdown, no extra text:
${SCHEMA}

Rules:
- strengths: up to 3 topics where accuracy_pct >= 70 and questions_seen >= 3, sorted best first
- weaknesses: up to 3 topics where accuracy_pct < 60 and questions_seen >= 2, worst first; suggestion must be a specific, actionable study tip (1 sentence)
- If fewer qualifying topics exist, return fewer items (not empty arrays if any qualify)
- raw_narrative: address the student directly, highlight one strength and one priority to improve`,
    messages: [
      {
        role: "user",
        content: `Analyse this student's performance data and generate their diagnostic report:\n\n${JSON.stringify(performanceSummary, null, 2)}`,
      },
    ],
  })

  const raw = message.content[0].type === "text" ? message.content[0].text : ""

  let parsed: DiagnosticOutput
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    parsed = JSON.parse(cleaned)
  }

  return parsed
}
