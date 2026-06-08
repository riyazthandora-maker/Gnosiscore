import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { ConfigSnapshot } from "@/types"

export interface OverviewStats {
  testsTaken: number
  avgScore: number
  bestScore: number
  totalTimeSecs: number
  totalAnswered: number
  accuracyPct: number
}

export interface HistoryPoint {
  date: string
  score: number
  toughness: string
  docTitle: string
  attemptId: string
}

export interface TopicStat {
  topic: string
  total: number
  correct: number
  accuracyPct: number
}

export interface AnalyticsPayload {
  overview: OverviewStats
  history: HistoryPoint[]
  topics: TopicStat[]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("id, score_pct, time_taken_secs, total_answered, completed_at, config_snapshot")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: true })

  if (!attempts?.length) {
    const empty: AnalyticsPayload = {
      overview: { testsTaken: 0, avgScore: 0, bestScore: 0, totalTimeSecs: 0, totalAnswered: 0, accuracyPct: 0 },
      history: [],
      topics: [],
    }
    return NextResponse.json(empty)
  }

  // Overview aggregation
  const scores = attempts.map((a) => a.score_pct ?? 0)
  const overview: OverviewStats = {
    testsTaken: attempts.length,
    avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
    bestScore: Math.max(...scores),
    totalTimeSecs: attempts.reduce((s, a) => s + (a.time_taken_secs ?? 0), 0),
    totalAnswered: attempts.reduce((s, a) => s + (a.total_answered ?? 0), 0),
    accuracyPct: 0, // filled after topic aggregation
  }

  // History (last 30)
  const history: HistoryPoint[] = attempts.slice(-30).map((a) => {
    const snap = a.config_snapshot as ConfigSnapshot
    return {
      date: new Date(a.completed_at!).toLocaleDateString("en", { month: "short", day: "numeric" }),
      score: Math.round(a.score_pct ?? 0),
      toughness: snap.toughness as string,
      docTitle: snap.document_title as string,
      attemptId: a.id,
    }
  })

  // Topic accuracy — fetch responses for all completed attempts
  const attemptIds = attempts.map((a) => a.id)
  const { data: responses } = await supabase
    .from("responses")
    .select("is_correct, questions!inner(topic_tag)")
    .in("attempt_id", attemptIds)

  const topicMap: Record<string, { total: number; correct: number }> = {}
  let totalCorrect = 0
  let totalAll = 0

  for (const r of responses ?? []) {
    const topic = (r.questions as unknown as { topic_tag: string | null })?.topic_tag
    totalAll++
    if (r.is_correct) totalCorrect++
    if (!topic) continue
    if (!topicMap[topic]) topicMap[topic] = { total: 0, correct: 0 }
    topicMap[topic].total++
    if (r.is_correct) topicMap[topic].correct++
  }

  overview.accuracyPct = totalAll > 0 ? (totalCorrect / totalAll) * 100 : 0

  const topics: TopicStat[] = Object.entries(topicMap)
    .map(([topic, { total, correct }]) => ({
      topic,
      total,
      correct,
      accuracyPct: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  return NextResponse.json({ overview, history, topics } satisfies AnalyticsPayload)
}
