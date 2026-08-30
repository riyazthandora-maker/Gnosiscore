"use client"

import { useEffect, useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { renderMixed } from "@/lib/exam/katex-utils"
import type { ExamQuestion } from "@/types"

const OPTION_KEYS = ["A", "B", "C", "D"] as const

interface Props {
  question: ExamQuestion
  index: number
  onChange: (q: ExamQuestion) => void
  onDelete: () => void
}

function KatexSpan({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    import("katex").then(({ default: katex }) => {
      if (!ref.current) return
      // Render inline (non-display) — split on $...$ and $$...$$
      const html = renderMixed(text, katex)
      ref.current.innerHTML = html
    })
  }, [text])

  return <span ref={ref} />
}


export function QuestionCard({ question, index, onChange, onDelete }: Props) {
  const [preview, setPreview] = useState(false)

  function setBody(body: string) { onChange({ ...question, body }) }
  function setOption(key: typeof OPTION_KEYS[number], val: string) {
    onChange({ ...question, options: { ...question.options, [key]: val } })
  }
  function setCorrect(key: typeof OPTION_KEYS[number]) { onChange({ ...question, correct: key }) }
  function setExplanation(explanation: string) { onChange({ ...question, explanation }) }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Q{index + 1}</span>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            question.difficulty === "easy"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-orange-500/15 text-orange-700 dark:text-orange-400"
          )}>
            {question.difficulty}
          </span>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{question.topic}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview(p => !p)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            {preview ? "Edit" : "Preview"}
          </button>
          <button
            onClick={onDelete}
            className="size-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Question body */}
        {preview ? (
          <div className="text-sm leading-relaxed katex-content">
            <KatexSpan text={question.body} />
          </div>
        ) : (
          <textarea
            value={question.body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            placeholder="Question text…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring resize-none transition-colors"
          />
        )}

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPTION_KEYS.map(key => (
            <div key={key} className="flex items-start gap-2">
              <button
                onClick={() => setCorrect(key)}
                className={cn(
                  "mt-1.5 size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                  question.correct === key
                    ? "border-primary bg-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                {question.correct === key && (
                  <span className="size-2 rounded-full bg-primary-foreground" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">{key}</span>
                </div>
                {preview ? (
                  <div className="text-sm leading-relaxed katex-content">
                    <KatexSpan text={question.options[key]} />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={question.options[key]}
                    onChange={e => setOption(key, e.target.value)}
                    placeholder={`Option ${key}…`}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Explanation */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Explanation</p>
          {preview ? (
            <div className="text-sm text-muted-foreground leading-relaxed katex-content">
              <KatexSpan text={question.explanation} />
            </div>
          ) : (
            <textarea
              value={question.explanation}
              onChange={e => setExplanation(e.target.value)}
              rows={2}
              placeholder="Why is this the correct answer?"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring resize-none transition-colors"
            />
          )}
        </div>
      </div>
    </div>
  )
}
