"use client"

import { useEffect, useState } from "react"
import { Check, ChevronDown, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExamQuestion } from "@/types"

const OPTIONS = ["A", "B", "C", "D"] as const

export function AutoExamReviewModal({
  planId,
  milestoneId,
  nodeTitle,
  onClose,
  onApproved,
  onRegenerated,
}: {
  planId: string
  milestoneId: string
  nodeTitle: string
  onClose: () => void
  onApproved: () => void
  onRegenerated: (paperId: string) => void
}) {
  const [loading, setLoading]         = useState(true)
  const [questions, setQuestions]     = useState<ExamQuestion[]>([])
  const [error, setError]             = useState("")
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [approving, setApproving]     = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    fetch(`/api/educator/pacing/${planId}/milestones/${milestoneId}/auto-exam`)
      .then(r => r.json())
      .then(d => {
        if (d.paper?.questions) setQuestions(d.paper.questions as ExamQuestion[])
        else setError("Could not load exam questions.")
      })
      .catch(() => setError("Network error loading exam."))
      .finally(() => setLoading(false))
  }, [planId, milestoneId])

  async function handleApprove() {
    setApproving(true)
    const res = await fetch(
      `/api/educator/pacing/${planId}/milestones/${milestoneId}/auto-exam/approve`,
      { method: "POST" }
    )
    setApproving(false)
    if (res.ok) { onApproved(); onClose() }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    const res = await fetch(
      `/api/educator/pacing/${planId}/milestones/${milestoneId}/auto-exam/regenerate`,
      { method: "POST" }
    )
    const data = await res.json()
    setRegenerating(false)
    if (res.ok) { onRegenerated(data.paperId); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet / Dialog */}
      <div className="relative z-10 w-full sm:max-w-xl bg-background rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh]">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Auto-Exam Review</p>
            <p className="text-sm font-semibold mt-0.5 leading-snug truncate">{nodeTitle}</p>
            {!loading && !error && (
              <p className="text-xs text-muted-foreground mt-0.5">{questions.length} question{questions.length !== 1 ? "s" : ""} — tap to expand each</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="size-5 text-muted-foreground animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive py-8 text-center">{error}</p>
          )}

          {!loading && !error && questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border overflow-hidden">
              {/* Question row — always visible */}
              <button
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
              >
                <span className="shrink-0 text-[11px] font-bold text-muted-foreground pt-0.5 w-5 text-center">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm leading-snug">{q.body}</span>
                <ChevronDown className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform mt-0.5",
                  expandedIdx === i && "rotate-180"
                )} />
              </button>

              {/* Options + explanation — visible when expanded */}
              {expandedIdx === i && (
                <div className="border-t border-border px-3 pt-3 pb-3 flex flex-col gap-2">
                  {OPTIONS.map(label => (
                    <div
                      key={label}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm",
                        q.correct === label
                          ? "bg-green-50 border border-green-200 text-green-900"
                          : "bg-muted/30 text-foreground/80"
                      )}
                    >
                      <span className={cn(
                        "shrink-0 text-xs font-bold mt-0.5 w-4",
                        q.correct === label ? "text-green-700" : "text-muted-foreground"
                      )}>
                        {label}
                      </span>
                      <span className="flex-1 leading-snug">{q.options[label]}</span>
                      {q.correct === label && (
                        <Check className="size-3.5 shrink-0 text-green-600 mt-0.5" />
                      )}
                    </div>
                  ))}

                  {q.explanation && (
                    <div className="mt-1 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800 leading-relaxed">
                      <span className="font-semibold">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="shrink-0 border-t border-border px-4 py-3 flex flex-col-reverse sm:flex-row gap-2">
            <button
              disabled={regenerating || approving}
              onClick={handleRegenerate}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn("size-3.5 shrink-0", regenerating && "animate-spin")} />
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              disabled={approving || regenerating}
              onClick={handleApprove}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check className="size-3.5 shrink-0" />
              {approving ? "Approving…" : "Approve & Assign"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
