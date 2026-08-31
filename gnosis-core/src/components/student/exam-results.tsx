"use client"

import { CheckCircle2, XCircle, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExamQuestion } from "@/types"

interface ExamResultsProps {
  examTitle: string
  score: number
  maxScore: number
  thresholdExcellent: number
  thresholdDistinction: number
  thresholdPass: number
  releaseResultsImmediately: boolean
  showExplanations: boolean
  questions: ExamQuestion[]
  answers: Record<string, string>
  onDone: () => void
}

function getGrade(pct: number, excellent: number, distinction: number, pass: number) {
  if (pct >= excellent) return { label: "Excellent", color: "text-emerald-600 dark:text-emerald-400" }
  if (pct >= distinction) return { label: "Distinction", color: "text-blue-600 dark:text-blue-400" }
  if (pct >= pass) return { label: "Pass", color: "text-amber-600 dark:text-amber-400" }
  return { label: "Failed", color: "text-destructive" }
}

export function ExamResults({
  examTitle,
  score,
  maxScore,
  thresholdExcellent,
  thresholdDistinction,
  thresholdPass,
  releaseResultsImmediately,
  showExplanations,
  questions,
  answers,
  onDone,
}: ExamResultsProps) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const { label, color } = getGrade(pct, thresholdExcellent, thresholdDistinction, thresholdPass)

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex flex-col items-center gap-3 text-center py-8 rounded-xl border border-border bg-card">
        <Trophy className="size-10 text-primary" />
        <h1 className="text-xl font-bold">Exam Submitted</h1>
        <p className="text-muted-foreground text-sm">{examTitle}</p>

        {releaseResultsImmediately ? (
          <div className="flex flex-col items-center gap-1 mt-2">
            <p className="text-4xl font-bold">{score} <span className="text-xl text-muted-foreground">/ {maxScore}</span></p>
            <p className={cn("text-lg font-semibold", color)}>{label} — {pct}%</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">Results will be released by your teacher.</p>
        )}
      </div>

      {releaseResultsImmediately && showExplanations && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-sm">Answer Review</h2>
          {questions.map((q, i) => {
            const given = answers[q.id]
            const correct = q.correct
            const isRight = given === correct
            return (
              <div
                key={q.id}
                className={cn(
                  "rounded-xl border p-4 flex flex-col gap-3",
                  isRight ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                           : "border-destructive/30 bg-destructive/5"
                )}
              >
                <div className="flex items-start gap-2">
                  {isRight
                    ? <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    : <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                  }
                  <p className="text-sm font-medium">{i + 1}. {q.body}</p>
                </div>
                <div className="flex flex-col gap-1 pl-6">
                  {(["A", "B", "C", "D"] as const).map(key => (
                    <p
                      key={key}
                      className={cn(
                        "text-sm px-2 py-1 rounded",
                        key === correct ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium" :
                        key === given && !isRight ? "bg-destructive/10 text-destructive line-through" :
                        "text-muted-foreground"
                      )}
                    >
                      {key}. {q.options[key]}
                    </p>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-xs text-muted-foreground pl-6 border-t border-border/50 pt-2 mt-1">{q.explanation}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={onDone}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Back to My Tests
      </button>
    </div>
  )
}
