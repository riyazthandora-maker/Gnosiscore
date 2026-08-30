"use client"

import { useEffect, useRef, useState } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWizard } from "@/components/exams/wizard-context"
import type { ExamQuestion } from "@/types"

// ── KaTeX rendering ───────────────────────────────────────────────────────────

function useKatexRenderer() {
  const [katex, setKatex] = useState<typeof import("katex").default | null>(null)
  useEffect(() => {
    import("katex").then(m => setKatex(m.default))
  }, [])
  return katex
}

function renderMixed(text: string, katex: typeof import("katex").default): string {
  const parts = text.split(/((?:\$\$[\s\S]+?\$\$|\$[^$\n]+?\$))/g)
  return parts.map(part => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      try { return katex.renderToString(part.slice(2, -2), { displayMode: true, throwOnError: false }) }
      catch { return part }
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      try { return katex.renderToString(part.slice(1, -1), { displayMode: false, throwOnError: false }) }
      catch { return part }
    }
    return part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }).join("")
}

function KatexText({ text, katex }: { text: string; katex: typeof import("katex").default | null }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!ref.current || !katex) return
    ref.current.innerHTML = renderMixed(text, katex)
  }, [text, katex])
  if (!katex) return <span>{text}</span>
  return <span ref={ref} />
}

// ── Question row ──────────────────────────────────────────────────────────────

const OPT_KEYS = ["A", "B", "C", "D"] as const

function QuestionRow({
  q,
  index,
  includeAnswers,
  katex,
}: {
  q: ExamQuestion
  index: number
  includeAnswers: boolean
  katex: typeof import("katex").default | null
}) {
  return (
    <div className="question-row break-inside-avoid mb-6 print:mb-8">
      {/* Body */}
      <p className="text-sm font-medium leading-relaxed mb-3 print:text-base print:mb-4">
        <span className="font-bold mr-1.5">{index + 1}.</span>
        <KatexText text={q.body} katex={katex} />
      </p>

      {/* Options — 2-col grid on screen, 2-col on print */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-5 print:pl-6 print:grid-cols-2 print:gap-2">
        {OPT_KEYS.map(key => (
          <div
            key={key}
            className={cn(
              "flex items-start gap-2 text-sm rounded-lg px-2 py-1 print:rounded-none print:px-0 print:py-0.5",
              includeAnswers && q.correct === key
                ? "bg-emerald-50 dark:bg-emerald-950/30 print:bg-transparent"
                : "print:bg-transparent"
            )}
          >
            <span className={cn(
              "font-semibold shrink-0 w-5 print:text-base",
              includeAnswers && q.correct === key
                ? "text-emerald-700 dark:text-emerald-400 print:text-black"
                : "text-muted-foreground print:text-black"
            )}>
              {key}.
            </span>
            <span className={cn(
              "leading-relaxed print:text-base",
              includeAnswers && q.correct === key && "font-medium print:font-normal"
            )}>
              <KatexText text={q.options[key]} katex={katex} />
            </span>
          </div>
        ))}
      </div>

      {/* Teacher-only answer + explanation */}
      {includeAnswers && (
        <div className="mt-3 ml-5 pl-3 border-l-2 border-emerald-500/40 print:border-black/30 print:ml-6">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold print:text-black print:text-sm">
            Answer: {q.correct}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 print:text-black print:text-sm">
            <KatexText text={q.explanation} katex={katex} />
          </p>
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Step5Preview() {
  const { questions, title, goNext, goBack } = useWizard()
  const [includeAnswers, setIncludeAnswers] = useState(false)
  const katex = useKatexRenderer()

  const displayTitle = title.trim() || "Exam Paper"
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

  function print() {
    window.print()
  }

  return (
    <>
      {/* Print-isolation styles */}
      <style>{`
        @media print {
          body > * { visibility: hidden; }
          .exam-print-area,
          .exam-print-area * { visibility: visible; }
          .exam-print-area {
            position: fixed;
            inset: 0;
            padding: 2cm 2.5cm;
            background: white;
            color: black;
          }
          .print-toolbar { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col gap-6">
        {/* Toolbar */}
        <div className="print-toolbar flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Print Preview</h2>
            <p className="text-sm text-muted-foreground">
              Toggle between copies, then print.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Teacher / Student toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30 text-sm">
              <button
                onClick={() => setIncludeAnswers(false)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium transition-colors",
                  !includeAnswers
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Student copy
              </button>
              <button
                onClick={() => setIncludeAnswers(true)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium transition-colors",
                  includeAnswers
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Teacher copy
              </button>
            </div>

            <Button onClick={print} className="gap-2">
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Paper */}
        <div className="exam-print-area rounded-xl border border-border bg-white dark:bg-card p-6 md:p-10 text-foreground">
          {/* Paper header */}
          <div className="border-b border-border pb-5 mb-6 print:pb-6 print:mb-8">
            <h1 className="text-xl font-bold text-center print:text-2xl">{displayTitle}</h1>
            <p className="text-sm text-center text-muted-foreground mt-1 print:text-base print:text-black">
              Date: {today}
            </p>
            <div className="mt-3 print:mt-4 flex items-center justify-between text-xs text-muted-foreground print:text-sm print:text-black">
              <span>Total questions: <strong>{questions.length}</strong></span>
              <span>Duration: ________ minutes</span>
              <span>Name: _______________________</span>
            </div>
            {includeAnswers && (
              <p className="mt-2 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-400 print:text-black print:text-sm">
                — TEACHER COPY (with answers & explanations) —
              </p>
            )}
          </div>

          {/* Questions */}
          <div>
            {questions.map((q, i) => (
              <QuestionRow
                key={q.id}
                q={q}
                index={i}
                includeAnswers={includeAnswers}
                katex={katex}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-border text-xs text-center text-muted-foreground print:text-black print:text-sm">
            End of paper — {questions.length} question{questions.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Navigation */}
        <div className="print-toolbar flex items-center justify-between">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={goNext}>Name & Save</Button>
        </div>
      </div>
    </>
  )
}
