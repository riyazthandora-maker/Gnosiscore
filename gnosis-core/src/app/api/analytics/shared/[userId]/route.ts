import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { ConfigSnapshot } from "@/types"
import type { OverviewStats, HistoryPoint, TopicStat, AnalyticsPayload } from "@/app/api/analytics/route"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify viewer has permission
  const { data: share } = await supabase
    .from("dashboard_shares")
    .select("id")
    .eq("owner_id", userId)
    .eq("viewer_id", user.id)
    .maybeSingle()

  if (!share) return NextResponse.json({ error: "Access denied." }, { status: 403 })

  // Fetch owner profile for display
  const { data: ownerProfile } = await supabase
    .from("users")
    .select("display_name, email")
    .eq("id", userId)
    .single()

  // Same aggregation as /api/analytics but for owner's data
  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("id, score_pct, time_taken_secs, total_answered, completed_at, config_snapshot")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true })

  if (!attempts?.length) {
    const empty: AnalyticsPayload = {
      overview: { testsTaken: 0, avgScore: 0, bestScore: 0, totalTimeSecs: 0, totalAnswered: 0, accuracyPct: 0 },
      history: [],
      topics: [],
    }
    return NextResponse.json({ ...empty, ownerName: ownerProfile?.display_name ?? ownerProfile?.email })
  }

  const scores = attempts.map((a) => a.score_pct ?? 0)
  const overview: OverviewStats = {
    testsTaken: attempts.length,
    avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
    bestScore: Math.max(...scores),
    totalTimeSecs: attempts.reduce((s, a) => s + (a.time_taken_secs ?? 0), 0),
    totalAnswered: attempts.reduce((s, a) => s + (a.total_answered ?? 0), 0),
    accuracyPct: 0,
  }

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

  const attemptIds = attempts.map((a) => a.id)
  const { data: responses } = await supabase
    .from("responses")
    .select("is_correct, questions!inner(topic_tag)")
    .in("attempt_id", attemptIds)

  const topicMap: Record<string, { total: number; correct: number }> = {}
  let totalCorrect = 0, totalAll = 0

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
      topic, total, correct, accuracyPct: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  return NextResponse.json({
    overview, history, topics,
    ownerName: ownerProfile?.display_name ?? ownerProfile?.email,
  })
}
