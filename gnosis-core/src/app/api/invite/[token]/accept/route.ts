import { createClient } from "@/lib/supabase/server"
import { generateQuestions } from "@/lib/ai/quiz-generator"
import { NextResponse } from "next/server"
import type { Toughness, ShowAnswerMode, ConfigSnapshot } from "@/types"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: invitation } = await supabase
    .from("test_invitations")
    .select(`
      id, status, expires_at, config_id,
      test_configs(
        id, toughness, total_questions, total_time_secs, per_question_secs,
        show_answer_mode, topic_filter, document_id,
        documents(id, title, status)
      )
    `)
    .eq("token", token)
    .maybeSingle()

  if (!invitation) return NextResponse.json({ error: "Invitation not found." }, { status: 404 })
  if (new Date(invitation.expires_at) < new Date()) return NextResponse.json({ error: "Expired." }, { status: 410 })
  if (invitation.status === "completed") return NextResponse.json({ error: "Already used." }, { status: 409 })

  const cfg = (invitation.test_configs as unknown) as {
    id: string; toughness: Toughness; total_questions: number;
    total_time_secs: number | null; per_question_secs: number | null;
    show_answer_mode: ShowAnswerMode; topic_filter: string[] | null;
    document_id: string; documents: { id: string; title: string; status: string }
  }

  if (!cfg || cfg.documents?.status !== "ready") {
    return NextResponse.json({ error: "Source document is not ready." }, { status: 409 })
  }

  const snapshot: ConfigSnapshot = {
    toughness: cfg.toughness,
    total_questions: cfg.total_questions,
    total_time_secs: cfg.total_time_secs,
    per_question_secs: cfg.per_question_secs,
    show_answer_mode: cfg.show_answer_mode,
    topic_filter: cfg.topic_filter,
    document_title: cfg.documents.title,
  }

  const { data: attempt, error: aErr } = await supabase
    .from("test_attempts")
    .insert({ config_id: cfg.id, user_id: user.id, config_snapshot: snapshot, status: "in_progress" })
    .select()
    .single()

  if (aErr || !attempt) return NextResponse.json({ error: "Failed to start attempt." }, { status: 500 })

  let questions
  try {
    ;({ questions } = await generateQuestions({
      documentIds: [cfg.document_id as string],
      difficulty: (cfg.toughness as import("@/types").Difficulty) ?? "medium",
      questionCount: (cfg.total_questions as number) ?? 10,
      topic: (cfg.topic_filter as string[] | null)?.join(", ") ?? undefined,
      supabase,
    }))
  } catch (err) {
    await supabase.from("test_attempts").delete().eq("id", attempt.id)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed." }, { status: 502 })
  }

  const rows = questions.map((q, i) => ({
    attempt_id: attempt.id,
    seq_number: i + 1,
    body: q.body,
    options: [
      { label: "A", text: q.options.A },
      { label: "B", text: q.options.B },
      { label: "C", text: q.options.C },
      { label: "D", text: q.options.D },
    ],
    correct_option: q.correct,
    explanation: q.explanation,
    topic_tag: q.topic,
    difficulty: cfg.toughness,
  }))

  await supabase.from("questions").insert(rows)
  await supabase.from("test_invitations").update({ status: "accepted" }).eq("id", invitation.id)

  return NextResponse.json({ attempt_id: attempt.id }, { status: 201 })
}
