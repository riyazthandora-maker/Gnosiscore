"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Flag, ChevronLeft, ChevronRight, AlertTriangle, Loader2, Clock } from "lucide-react"
import { useExamSecurity } from "@/lib/hooks/use-exam-security"
import type { ExamQuestion } from "@/types"
import { cn } from "@/lib/utils"

interface ExamTakerProps {
  assignmentId: string
  sessionId: string
  questions: ExamQuestion[]
  initialAnswers: Record<string, string>
  initialFlagged: string[]
  initialElapsed: number
  durationMinutes: number
  allowBacktrack: boolean
  mandatoryAnswering: boolean
  flagForReview: boolean
  randomizeQuestions: boolean
  shuffleAnswers: boolean
  browserLockdown: boolean
  disableCopyPaste: boolean
  tabSwitchWarnings: boolean
  tabSwitchLimit: number
  onComplete: (result: { score: number; maxScore: number; answers: Record<string, string> }) => void
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// Seeded shuffle so order is stable per session
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  for (let i = result.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) | 0
    const j = Math.abs(h) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function ExamTaker({
  assignmentId,
  sessionId,
  questions: rawQuestions,
  initialAnswers,
  initialFlagged,
  initialElapsed,
  durationMinutes,
  allowBacktrack,
  mandatoryAnswering,
  flagForReview,
  randomizeQuestions,
  shuffleAnswers,
  browserLockdown,
  disableCopyPaste,
  tabSwitchWarnings,
  tabSwitchLimit,
  onComplete,
}: ExamTakerProps) {
  const questions = randomizeQuestions
    ? seededShuffle(rawQuestions, sessionId)
    : rawQuestions

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const [flagged, setFlagged] = useState<Set<string>>(new Set(initialFlagged))
  const [elapsed, setElapsed] = useState(initialElapsed)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [tabWarning, setTabWarning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const autoSubmitFiredRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalSeconds = durationMinutes * 60
  const remaining = totalSeconds - elapsed
  const isExpired = remaining <= 0

  const currentQuestion = questions[currentIndex]

  // Shuffle options per question (stable via question id seed)
  const optionOrder = shuffleAnswers
    ? seededShuffle(OPTION_KEYS as unknown as string[], currentQuestion.id) as typeof OPTION_KEYS[number][]
    : [...OPTION_KEYS]

  const saveProgress = useCallback(async (extra?: Record<string, unknown>) => {
    await fetch(`/api/student/exam/${assignmentId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        action: "save_answers",
        answers,
        flagged_questions: [...flagged],
        elapsed_seconds: elapsed,
        tab_switch_count: tabSwitches,
        ...extra,
      }),
    })
  }, [assignmentId, sessionId, answers, flagged, elapsed, tabSwitches])

  const submitExam = useCallback(async (auto = false) => {
    if (autoSubmitFiredRef.current) return
    autoSubmitFiredRef.current = true
    setSubmitting(true)
    if (saveTimerRef.current) clearInterval(saveTimerRef.current)

    const res = await fetch(`/api/student/exam/${assignmentId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        action: auto ? "auto_submit" : "submit",
        answers,
        flagged_questions: [...flagged],
        elapsed_seconds: elapsed,
        tab_switch_count: tabSwitches,
      }),
    })
    const data = await res.json()
    const session = data.session
    onComplete({ score: session.score ?? 0, maxScore: session.max_score ?? questions.length, answers })
  }, [assignmentId, sessionId, answers, flagged, elapsed, tabSwitches, questions.length, onComplete])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= totalSeconds && !autoSubmitFiredRef.current) {
          clearInterval(interval)
          submitExam(true)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [totalSeconds, submitExam])

  // Auto-save every 30 seconds
  useEffect(() => {
    saveTimerRef.current = setInterval(() => { saveProgress() }, 30_000)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [saveProgress])

  // Security hook
  useExamSecurity({
    enabled: true,
    browserLockdown,
    disableCopyPaste,
    tabSwitchWarnings,
    tabSwitchLimit,
    onTabSwitch: (count) => {
      setTabSwitches(count)
      setTabWarning(true)
    },
    onLimitExceeded: () => submitExam(true),
  })

  const selectAnswer = (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }))
  }

  const toggleFlag = (questionId: string) => {
    setFlagged(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  const goNext = () => {
    if (mandatoryAnswering && !answers[currentQuestion.id]) return
    if (currentIndex < questions.length - 1) setCurrentIndex(i => i + 1)
  }

  const goPrev = () => {
    if (allowBacktrack && currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  const canSubmit = !mandatoryAnswering || questions.every(q => answers[q.id])

  if (submitting) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Submitting your exam…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{currentIndex + 1} / {questions.length}</span>
          <div className="flex gap-1 ml-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => (allowBacktrack || i > currentIndex) ? setCurrentIndex(i) : undefined}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i === currentIndex ? "bg-primary" :
                  answers[q.id] ? "bg-primary/40" :
                  flagged.has(q.id) ? "bg-amber-400" :
                  "bg-border"
                )}
              />
            ))}
          </div>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 text-sm font-mono font-medium",
          remaining <= 60 ? "text-destructive" : remaining <= 300 ? "text-amber-500" : "text-foreground"
        )}>
          <Clock className="size-4" />
          {isExpired ? "0:00" : formatTime(remaining)}
        </div>
      </div>

      {/* Tab switch warning */}
      {tabWarning && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-2.5">
          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Tab switch detected ({tabSwitches}/{tabSwitchLimit}). Exceeding the limit will auto-submit your exam.
          </p>
          <button onClick={() => setTabWarning(false)} className="ml-auto text-xs text-amber-500 hover:text-amber-700">Dismiss</button>
        </div>
      )}

      {/* Question card */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-medium leading-relaxed">{currentQuestion.body}</p>
          {flagForReview && (
            <button
              onClick={() => toggleFlag(currentQuestion.id)}
              className={cn(
                "shrink-0 rounded-lg p-1.5 transition-colors",
                flagged.has(currentQuestion.id)
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Flag for review"
            >
              <Flag className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {optionOrder.map(key => {
            const text = currentQuestion.options[key]
            const selected = answers[currentQuestion.id] === key
            return (
              <button
                key={key}
                onClick={() => selectAnswer(currentQuestion.id, key)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-primary/40 hover:bg-accent"
                )}
              >
                <span className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                )}>
                  {key}
                </span>
                {text}
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={!allowBacktrack || currentIndex === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="size-4" /> Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            onClick={goNext}
            disabled={mandatoryAnswering && !answers[currentQuestion.id]}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Next <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={() => submitExam(false)}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Submit Exam
          </button>
        )}
      </div>

      {mandatoryAnswering && !answers[currentQuestion.id] && (
        <p className="text-xs text-muted-foreground text-center">Answer this question to continue</p>
      )}
    </div>
  )
}
