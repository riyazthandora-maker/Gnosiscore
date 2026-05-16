"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Clock, ChevronRight, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ConfigSnapshot } from "@/types"

interface QuestionData {
  id: string
  seq_number: number
  body: string
  options: { label: string; text: string }[]
  correct_option?: string
  explanation?: string
  topic_tag?: string
}

interface AttemptData {
  id: string
  config_snapshot: ConfigSnapshot
  started_at: string
}

interface ResponseRecord {
  question_id: string
  selected_option: "A" | "B" | "C" | "D" | null
  time_spent_secs: number | null
}

type Phase = "loading" | "playing" | "review" | "submitting" | "error"

function useCountdown(seconds: number | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(seconds)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const reset = useCallback((secs: number | null) => {
    if (ref.current) clearInterval(ref.current)
    setRemaining(secs)
    if (secs == null) return
    ref.current = setInterval(() => {
      setRemaining((r) => {
        if (r == null || r <= 1) {
          clearInterval(ref.current!)
          onExpire()
          return 0
        }
        return r - 1
      })
    }, 1000)
  }, [onExpire])

  useEffect(() => () => { if (ref.current) clearInterval(ref.current) }, [])

  return { remaining, reset }
}

export function QuizPlayer({ attemptId }: { attemptId: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("loading")
  const [attempt, setAttempt] = useState<AttemptData | null>(null)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<"A" | "B" | "C" | "D" | null>(null)
  const [responses, setResponses] = useState<ResponseRecord[]>([])
  const [errorMsg, setErrorMsg] = useState("")
  const questionStartRef = useRef<number>(Date.now())

  const snapshot = attempt?.config_snapshot
  const perQ = snapshot?.per_question_secs ?? null
  const showMode = snapshot?.show_answer_mode ?? "end"

  const advanceOrSubmit = useCallback(() => {
    setCurrent((c) => c + 1)
    setSelected(null)
    setPhase("playing")
    questionStartRef.current = Date.now()
  }, [])

  const handleExpire = useCallback(() => {
    if (phase !== "playing") return
    const q = questions[current]
    if (!q) return
    const spent = Math.round((Date.now() - questionStartRef.current) / 1000)
    setResponses((r) => [...r, { question_id: q.id, selected_option: null, time_spent_secs: spent }])
    advanceOrSubmit()
  }, [phase, questions, current, advanceOrSubmit])

  const { remaining, reset: resetTimer } = useCountdown(perQ, handleExpire)

  // Load attempt + questions
  useEffect(() => {
    fetch(`/api/tests/${attemptId}`)
      .then((r) => r.json())
      .then(({ attempt: a, questions: qs }) => {
        setAttempt(a)
        setQuestions(qs)
        setPhase("playing")
        questionStartRef.current = Date.now()
        resetTimer(perQ)
      })
      .catch(() => {
        setErrorMsg("Failed to load test. Please refresh.")
        setPhase("error")
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  // Reset per-question timer whenever question changes
  useEffect(() => {
    if (phase === "playing") resetTimer(perQ)
  }, [current, phase, perQ, resetTimer])

  // Auto-submit when all questions answered
  useEffect(() => {
    if (responses.length > 0 && responses.length === questions.length) {
      submit(responses)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, questions.length])

  async function submit(finalResponses: ResponseRecord[]) {
    setPhase("submitting")
    const res = await fetch(`/api/tests/${attemptId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: finalResponses }),
    })
    if (!res.ok) {
      setErrorMsg("Failed to submit. Please try again.")
      setPhase("error")
      return
    }
    router.push(`/test/${attemptId}/results`)
  }

  function handleSelect(option: "A" | "B" | "C" | "D") {
    if (selected || phase !== "playing") return
    setSelected(option)

    const q = questions[current]
    const spent = Math.round((Date.now() - questionStartRef.current) / 1000)
    const record: ResponseRecord = { question_id: q.id, selected_option: option, time_spent_secs: spent }

    if (showMode === "immediate") {
      setPhase("review")
      setResponses((r) => [...r, record])
    } else {
      setResponses((r) => [...r, record])
      advanceOrSubmit()
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-sm text-destructive">{errorMsg}</p>
        <Button variant="outline" onClick={() => router.push("/documents")}>Back to documents</Button>
      </div>
    )
  }

  if (phase === "submitting") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Saving your results…</p>
      </div>
    )
  }

  const q = questions[current]
  if (!q) return null

  const totalQ = questions.length
  const progress = ((current) / totalQ) * 100
  const isCorrect = selected === q.correct_option

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground shrink-0">
            {current + 1} / {totalQ}
          </span>
          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          {remaining != null && (
            <div className={cn(
              "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-mono font-medium tabular-nums",
              remaining <= 10 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
            )}>
              <Clock className="size-3" />
              {remaining}s
            </div>
          )}
        </div>
      </header>

      {/* Question */}
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-2xl space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {q.topic_tag && (
                <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {q.topic_tag}
                </span>
              )}

              <p className="text-lg font-medium leading-relaxed">{q.body}</p>

              <div className="space-y-3">
                {q.options.map((opt) => {
                  const isSelected = selected === opt.label
                  const showResult = phase === "review"
                  const optCorrect = opt.label === q.correct_option
                  const optWrong = isSelected && !optCorrect

                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleSelect(opt.label as "A" | "B" | "C" | "D")}
                      disabled={!!selected}
                      className={cn(
                        "group w-full flex items-start gap-3 rounded-xl border p-4 text-left text-sm transition-all",
                        !selected && "hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
                        isSelected && !showResult && "border-primary bg-primary/8",
                        showResult && optCorrect && "border-green-500 bg-green-500/10",
                        showResult && optWrong && "border-destructive bg-destructive/10",
                        !isSelected && showResult && !optCorrect && "opacity-50",
                        selected && !showResult && !isSelected && "opacity-50"
                      )}
                    >
                      <span className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                        isSelected && !showResult && "border-primary bg-primary text-primary-foreground",
                        showResult && optCorrect && "border-green-500 bg-green-500 text-white",
                        showResult && optWrong && "border-destructive bg-destructive text-white",
                        !isSelected && "border-border"
                      )}>
                        {showResult && optCorrect ? <CheckCircle2 className="size-3.5" /> :
                         showResult && optWrong ? <XCircle className="size-3.5" /> :
                         opt.label}
                      </span>
                      <span>{opt.text}</span>
                    </button>
                  )
                })}
              </div>

              {/* Immediate review panel */}
              {phase === "review" && q.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-xl border p-4 text-sm",
                    isCorrect ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <p className={cn("mb-1 font-semibold", isCorrect ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </p>
                  <p className="text-muted-foreground">{q.explanation}</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Next button (immediate mode only) */}
      {phase === "review" && (
        <div className="sticky bottom-0 border-t border-border bg-background/80 backdrop-blur px-6 py-4">
          <div className="mx-auto max-w-2xl flex justify-end">
            <Button onClick={advanceOrSubmit} className="gap-2">
              {current + 1 < totalQ ? "Next question" : "See results"}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
