import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { CheckCircle2, XCircle, ArrowLeft, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface GradedOption {
  label: string
  text: string
  is_correct: boolean
}

interface GradedQuestion {
  id: string
  question_text: string
  options: GradedOption[]
  explanation: string | null
  difficulty: string | null
  topic_tags: string[]
  student_answer: string | null
  correct_answer: string | null
  is_correct: boolean
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444"

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} stroke="currentColor" strokeWidth="10" fill="none" className="text-muted/30" />
        <circle
          cx="70" cy="70" r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tabular-nums">{pct}%</span>
        <span className="text-xs text-muted-foreground">score</span>
      </div>
    </div>
  )
}

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: attempt } = await supabase
    .from("test_attempts")
    .select("id, score, max_score, answers, completed_at, config_snapshot")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  if (!attempt) redirect(`/student/test/${testId}`)

  // Fetch assignment settings for show_answer_key
  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("show_answer_key")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .single()

  const showAnswerKey = assignment?.show_answer_key !== false

  const { data: test } = await supabase
    .from("tests")
    .select("id, title, question_ids")
    .eq("id", testId)
    .single()

  if (!test) redirect("/student")

  const score = attempt.score ?? 0
  const maxScore = attempt.max_score ?? 0
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const completedAt = attempt.completed_at
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(attempt.completed_at))
    : null

  const passLabel = pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Fair" : "Needs work"

  // Only fetch question details if answer key is visible
  let graded: GradedQuestion[] = []
  if (showAnswerKey) {
    const { data: questions } = await supabase
      .from("questions")
      .select("id, question_text, options, explanation, difficulty, topic_tags")
      .in("id", test.question_ids)
      .eq("status", "approved")

    const studentAnswers = (attempt.answers ?? {}) as Record<string, string>

    graded = (test.question_ids as string[])
      .map((qid) => {
        const q = questions?.find((x) => x.id === qid)
        if (!q) return null
        const opts = q.options as GradedOption[]
        const correctLabel = opts.find((o) => o.is_correct)?.label ?? null
        const studentAnswer = studentAnswers[qid] ?? null
        return {
          id: qid,
          question_text: q.question_text,
          options: opts,
          explanation: q.explanation,
          difficulty: q.difficulty,
          topic_tags: q.topic_tags,
          student_answer: studentAnswer,
          correct_answer: correctLabel,
          is_correct: correctLabel !== null && studentAnswer === correctLabel,
        }
      })
      .filter(Boolean) as GradedQuestion[]
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      {/* Score summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
            <p className="mt-1 text-muted-foreground">{passLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {score} / {maxScore} correct
              {completedAt && <> · Completed {completedAt}</>}
            </p>
          </div>
          <ScoreRing pct={pct} />
        </div>
      </div>

      {/* Answer key hidden notice */}
      {!showAnswerKey && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-5 py-4">
          <EyeOff className="size-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Your teacher has hidden the answer key for this test.
          </p>
        </div>
      )}

      {/* Per-question breakdown */}
      {showAnswerKey && graded.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Question breakdown
          </h2>

          {graded.map((q, idx) => (
            <div
              key={q.id}
              className={cn(
                "rounded-xl border bg-card overflow-hidden",
                q.is_correct ? "border-green-500/30" : "border-destructive/30"
              )}
            >
              <div className={cn(
                "flex items-start gap-3 px-5 py-4",
                q.is_correct ? "bg-green-500/5" : "bg-destructive/5"
              )}>
                {q.is_correct
                  ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                  : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                    {q.question_text}
                  </p>
                </div>
              </div>

              <div className="px-5 py-4 space-y-2">
                {q.options.map((opt) => {
                  const isStudentPick = q.student_answer === opt.label
                  const isCorrect = opt.is_correct
                  return (
                    <div
                      key={opt.label}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                        isCorrect
                          ? "bg-green-500/10 text-green-800 dark:text-green-300 font-medium"
                          : isStudentPick && !isCorrect
                          ? "bg-destructive/10 text-destructive line-through"
                          : "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <span className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        isCorrect
                          ? "bg-green-500 text-white"
                          : isStudentPick && !isCorrect
                          ? "bg-destructive text-white"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {opt.label}
                      </span>
                      <span>{opt.text}</span>
                      {isStudentPick && !isCorrect && (
                        <span className="ml-auto shrink-0 text-xs text-destructive">Your answer</span>
                      )}
                      {isCorrect && (
                        <span className="ml-auto shrink-0 text-xs text-green-600 dark:text-green-400">Correct</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {q.explanation && (
                <div className="border-t border-border bg-muted/20 px-5 py-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Explanation: </span>
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="flex justify-center pb-6">
        <Link
          href="/student"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to My Tests
        </Link>
      </div>
    </div>
  )
}
