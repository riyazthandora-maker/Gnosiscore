"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Clock, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QuizQuestion {
  id: string
  question_text: string
  options: { label: string; text: string }[]
  difficulty: string
  topic_tags: string[]
}

interface TestData {
  id: string
  title: string
  description: string | null
  question_ids: string[]
  time_limit_min: number | null
  due_at: string | null
  questions: QuizQuestion[]
}

type Phase = "loading" | "playing" | "confirming" | "submitting"

function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (remaining <= 0) { onExpireRef.current(); return }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const urgent = remaining < 60

  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-medium tabular-nums",
      urgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"
    )}>
      <Clock className="size-3.5" />
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  )
}

export default function QuizPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = use(params)
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>("loading")
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [direction, setDirection] = useState<1 | -1>(1)

  const { data, error: fetchError } = useQuery<{ attempted: boolean; attempt_id?: string; test?: TestData }>({
    queryKey: ["student-test", testId],
    queryFn: () => fetch(`/api/student/tests/${testId}`).then((r) => r.json()),
  })

  useEffect(() => {
    if (!data) return
    if (data.attempted) {
      router.replace(`/student/test/${testId}/results`)
      return
    }
    if (data.test) setPhase("playing")
  }, [data, testId, router])

  const test = data?.test
  const questions = test?.questions ?? []
  const currentQ = questions[currentIdx]
  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === questions.length

  const { mutate: submit, isPending: submitting } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/student/tests/${testId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => {
      router.push(`/student/test/${testId}/results`)
    },
  })

  const handleExpire = useCallback(() => {
    setPhase("submitting")
    submit()
  }, [submit])

  function selectAnswer(questionId: string, label: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: label }))
  }

  function navigate(delta: 1 | -1) {
    const next = currentIdx + delta
    if (next < 0 || next >= questions.length) return
    setDirection(delta)
    setCurrentIdx(next)
  }

  function goToQuestion(idx: number) {
    setDirection(idx > currentIdx ? 1 : -1)
    setCurrentIdx(idx)
  }

  if (fetchError || (data && !data.test && !data.attempted)) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="font-medium">Test not available</p>
        <p className="text-sm text-muted-foreground">This test may not be assigned to you.</p>
        <Button variant="outline" onClick={() => router.push("/student")}>Back to My Tests</Button>
      </div>
    )
  }

  if (phase === "loading" || !test || !currentQ) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading test…</p>
      </div>
    )
  }

  if (phase === "confirming") {
    const unanswered = questions.length - answeredCount
    return (
      <div className="mx-auto max-w-md py-10 space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <div>
            <h2 className="text-lg font-bold">Submit test?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You answered {answeredCount} of {questions.length} questions.
              {unanswered > 0 && (
                <span className="text-amber-600 dark:text-amber-400"> {unanswered} unanswered.</span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="gap-2"
              onClick={() => { setPhase("submitting"); submit() }}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Submit now
            </Button>
            <Button variant="ghost" onClick={() => setPhase("playing")}>
              Review answers first
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "submitting") {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Submitting your answers…</p>
      </div>
    )
  }

  const isLast = currentIdx === questions.length - 1
  const currentAnswer = answers[currentQ.id]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold">{test.title}</p>
          <p className="text-xs text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </p>
        </div>
        {test.time_limit_min && (
          <Timer seconds={test.time_limit_min * 60} onExpire={handleExpire} />
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentQ.id}
          custom={direction}
          initial={{ opacity: 0, x: direction * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -40 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-border bg-card p-6 space-y-5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
              Q{currentIdx + 1}
            </span>
            <p className="text-base font-medium leading-relaxed">{currentQ.question_text}</p>
          </div>

          <div className="space-y-2.5">
            {currentQ.options.map((opt) => {
              const selected = currentAnswer === opt.label
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => selectAnswer(currentQ.id, opt.label)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <span className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                  )}>
                    {opt.label}
                  </span>
                  <span className="text-sm">{opt.text}</span>
                </button>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIdx === 0}
          onClick={() => navigate(-1)}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" /> Previous
        </Button>

        {isLast ? (
          <Button
            className="gap-2"
            onClick={() => setPhase("confirming")}
          >
            <CheckCircle2 className="size-4" />
            {allAnswered ? "Submit" : `Submit (${answeredCount}/${questions.length} answered)`}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => navigate(1)}
            className="gap-1.5"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      {/* Question navigator dots */}
      <div className="flex flex-wrap justify-center gap-1.5 pt-2">
        {questions.map((q, idx) => {
          const answered = Boolean(answers[q.id])
          const isCurrent = idx === currentIdx
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => goToQuestion(idx)}
              title={`Question ${idx + 1}${answered ? " (answered)" : ""}`}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : answered
                  ? "bg-primary/20 text-primary hover:bg-primary/30"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              )}
            >
              {idx + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
