"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Minus, Trophy, Clock, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ConfigSnapshot } from "@/types"

interface QuestionResult {
  id: string
  seq_number: number
  body: string
  options: { label: string; text: string }[]
  correct_option: string
  explanation: string | null
  topic_tag: string | null
}

interface ResponseResult {
  question_id: string
  selected_option: string | null
  is_correct: boolean | null
  time_spent_secs: number | null
}

interface AttemptResult {
  id: string
  score_pct: number
  total_answered: number
  time_taken_secs: number
  config_snapshot: ConfigSnapshot
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444"

  return (
    <div className="relative flex items-center justify-center">
      <svg width={128} height={128} className="-rotate-90">
        <circle cx={64} cy={64} r={r} fill="none" stroke="currentColor" strokeWidth={8} className="text-muted" />
        <motion.circle
          cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold">{Math.round(pct)}%</p>
        <p className="text-xs text-muted-foreground">score</p>
      </div>
    </div>
  )
}

export function ResultsSummary({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<{ attempt: AttemptResult; questions: QuestionResult[]; responses: ResponseResult[] } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/tests/${attemptId}/results`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true))
  }, [attemptId])

  if (error) return <p className="text-destructive text-sm p-8">Failed to load results.</p>
  if (!data) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  const { attempt, questions, responses } = data
  const snap = attempt.config_snapshot
  const responseMap = Object.fromEntries(responses.map((r) => [r.question_id, r]))
  const hideAnswers = snap.show_answer_mode === "hidden"

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">

      {/* ── Config snapshot (required per spec) ── */}
      <section className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Test configuration</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Document</dt>
            <dd className="font-medium truncate">{snap.document_title}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Difficulty</dt>
            <dd className="font-medium capitalize">{snap.toughness}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Questions</dt>
            <dd className="font-medium">{snap.total_questions}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total time</dt>
            <dd className="font-medium">{snap.total_time_secs ? formatTime(snap.total_time_secs) : "Untimed"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Per question</dt>
            <dd className="font-medium">{snap.per_question_secs ? `${snap.per_question_secs}s` : "None"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Answers shown</dt>
            <dd className="font-medium capitalize">{snap.show_answer_mode}</dd>
          </div>
          {snap.topic_filter?.length ? (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-muted-foreground">Topics</dt>
              <dd className="font-medium">{snap.topic_filter.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* ── Score summary ── */}
      <section className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-6 sm:flex-row">
        <ScoreRing pct={attempt.score_pct} />
        <div className="space-y-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            <p className="text-lg font-bold">
              {attempt.score_pct >= 80 ? "Great work!" : attempt.score_pct >= 50 ? "Good effort." : "Keep practising."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm sm:justify-start">
            <div>
              <span className="text-muted-foreground">Answered </span>
              <span className="font-semibold">{attempt.total_answered} / {questions.length}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" />
              <span>{formatTime(attempt.time_taken_secs)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Per-question breakdown ── */}
      {!hideAnswers && (
        <section className="space-y-4">
          <h2 className="font-semibold">Question breakdown</h2>
          {questions.map((q) => {
            const resp = responseMap[q.id]
            const isCorrect = resp?.is_correct
            const chosen = resp?.selected_option

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: q.seq_number * 0.04 }}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    isCorrect ? "bg-green-500/15 text-green-500" :
                    chosen == null ? "bg-muted text-muted-foreground" :
                    "bg-destructive/15 text-destructive"
                  )}>
                    {isCorrect ? <CheckCircle2 className="size-3.5" /> :
                     chosen == null ? <Minus className="size-3.5" /> :
                     <XCircle className="size-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{q.body}</p>
                    {q.topic_tag && (
                      <span className="mt-1 inline-block text-xs text-muted-foreground">{q.topic_tag}</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-1.5 pl-8">
                  {q.options.map((opt) => {
                    const isChosen = opt.label === chosen
                    const isRight = opt.label === q.correct_option
                    return (
                      <div
                        key={opt.label}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs",
                          isRight && "bg-green-500/10 text-green-700 dark:text-green-300",
                          isChosen && !isRight && "bg-destructive/10 text-destructive",
                          !isRight && !isChosen && "text-muted-foreground"
                        )}
                      >
                        <span className="font-bold w-4 shrink-0">{opt.label}</span>
                        {opt.text}
                        {isRight && <span className="ml-auto font-medium">✓ correct</span>}
                        {isChosen && !isRight && <span className="ml-auto font-medium">your answer</span>}
                      </div>
                    )
                  })}
                </div>

                {q.explanation && snap.show_answer_mode !== "hidden" && (
                  <p className="pl-8 text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
                )}
              </motion.div>
            )
          })}
        </section>
      )}

      <div className="flex flex-wrap gap-3 pb-8">
        <Link href={`/tests/new?docId=${questions[0] ? encodeURIComponent("") : ""}`}>
          <Button variant="outline" className="gap-2">
            <RotateCcw className="size-4" /> New test from same document
          </Button>
        </Link>
        <Link href="/documents">
          <Button variant="ghost">Back to documents</Button>
        </Link>
      </div>
    </div>
  )
}
