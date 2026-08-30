"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, RefreshCw, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWizard } from "@/components/exams/wizard-context"
import { QuestionCard } from "@/components/exams/question-card"
import type { ExamQuestion } from "@/types"

type GenerateStatus = "idle" | "loading" | "error"

export function Step4Editor() {
  const { books, selectedNodeIds, weightages, settings, questions, setQuestions, generalInstruction, goNext, goBack } = useWizard()

  const [status, setStatus] = useState<GenerateStatus>(questions.length > 0 ? "idle" : "loading")
  const [errorMsg, setErrorMsg] = useState("")
  const hasFetched = useRef(false)

  async function generate() {
    setStatus("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/educator/exams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          books,
          selectedNodeIds: Array.from(selectedNodeIds),
          weightages,
          settings,
          general_instruction: generalInstruction || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      setQuestions(data.questions as ExamQuestion[])
      setStatus("idle")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error")
      setStatus("error")
    }
  }

  useEffect(() => {
    if (hasFetched.current || questions.length > 0) return
    hasFetched.current = true
    generate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateQuestion(index: number, q: ExamQuestion) {
    setQuestions(questions.map((old, i) => (i === index ? q : old)))
  }

  function deleteQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const easy = questions.filter(q => q.difficulty === "easy").length
  const hard = questions.filter(q => q.difficulty === "hard").length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold mb-0.5">Review & Edit Questions</h2>
          <p className="text-sm text-muted-foreground">
            Edit questions, change the correct answer, or delete any you don&apos;t want.
          </p>
        </div>
        {status === "idle" && questions.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" />{easy} easy</span>
              <span>·</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-orange-500 inline-block" />{hard} hard</span>
              <span>·</span>
              <span className="font-medium text-foreground">{questions.length} total</span>
            </div>
            <Button variant="outline" size="sm" onClick={generate} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Regenerate
            </Button>
          </div>
        )}
      </div>

      {/* Loading */}
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-xl border border-dashed border-border">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-medium">Generating questions…</p>
            <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-destructive/30 bg-destructive/5">
          <AlertCircle className="size-8 text-destructive" />
          <div className="text-center">
            <p className="font-medium text-destructive">Generation failed</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">{errorMsg}</p>
          </div>
          <Button variant="outline" onClick={generate} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      )}

      {/* Questions list */}
      {status === "idle" && (
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              onChange={updated => updateQuestion(i, updated)}
              onDelete={() => deleteQuestion(i)}
            />
          ))}
          {questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">All questions deleted.</p>
              <Button variant="outline" size="sm" onClick={generate} className="gap-1.5">
                <RefreshCw className="size-3.5" />
                Regenerate
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {status !== "loading" && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={goNext} disabled={questions.length === 0}>
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}
