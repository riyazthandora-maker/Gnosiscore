"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Question, QuestionOption } from "@/types"

interface EditableQuestion extends Question {
  editing: boolean
  draft: {
    question_text: string
    options: QuestionOption[]
    explanation: string
  }
}

function QuestionCard({
  q,
  onAction,
  isPending,
}: {
  q: EditableQuestion
  onAction: (id: string, action: "approve" | "reject", edits?: EditableQuestion["draft"]) => void
  isPending: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [editText, setEditText] = useState(q.draft.question_text)
  const [editOptions, setEditOptions] = useState(q.draft.options)
  const [editExplanation, setEditExplanation] = useState(q.draft.explanation)

  const correct = editOptions.find((o) => o.is_correct)?.label ?? "A"

  function setCorrect(label: string) {
    setEditOptions((prev) => prev.map((o) => ({ ...o, is_correct: o.label === label })))
  }

  const edits = {
    question_text: editText,
    options: editOptions.map((o) => ({ ...o, text: o.text })),
    explanation: editExplanation,
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize">
            {q.difficulty}
          </span>
          {q.topic_tags.length > 0 && (
            <span className="truncate text-xs text-muted-foreground">{q.topic_tags[0]}</span>
          )}
        </div>
        {expanded ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-5 pb-5">
              {/* Question text */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Question</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>

              {/* Options */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Options <span className="font-normal">(click label to mark correct)</span>
                </label>
                <div className="space-y-2">
                  {editOptions.map((opt) => (
                    <div key={opt.label} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrect(opt.label)}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                          opt.is_correct
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-border text-muted-foreground hover:border-green-500/50"
                        )}
                      >
                        {opt.label}
                      </button>
                      <input
                        value={opt.text}
                        onChange={(e) =>
                          setEditOptions((prev) =>
                            prev.map((o) => o.label === opt.label ? { ...o, text: e.target.value } : o)
                          )
                        }
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30",
                          opt.is_correct ? "border-green-500/50 bg-green-500/5" : "border-input bg-background"
                        )}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Correct answer: <span className="font-medium text-green-600 dark:text-green-400">{correct}</span>
                </p>
              </div>

              {/* Explanation */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Explanation</label>
                <textarea
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() => onAction(q.id, "reject")}
                >
                  <XCircle className="size-3.5" /> Reject
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={isPending}
                  onClick={() => onAction(q.id, "approve", edits)}
                >
                  {isPending
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <CheckCircle2 className="size-3.5" />}
                  Approve
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ReviewPage() {
  const qc = useQueryClient()
  const router = useRouter()

  const { data, isLoading } = useQuery<{ questions: Question[] }>({
    queryKey: ["questions-pending"],
    queryFn: () => fetch("/api/educator/questions?status=pending_review").then((r) => r.json()),
  })

  const pending = data?.questions ?? []

  // Track which IDs have been actioned locally so they animate out
  const [actioned, setActioned] = useState<Set<string>>(new Set())

  const { mutate, isPending } = useMutation({
    mutationFn: async (payload: {
      id: string
      action: "approve" | "reject"
      edits?: Question["options"] extends infer O ? { question_text: string; options: O; explanation: string } : never
    }) => {
      const res = await fetch("/api/educator/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return payload.id
    },
    onSuccess: (id) => {
      setActioned((prev) => new Set(prev).add(id))
      qc.invalidateQueries({ queryKey: ["questions-pending"] })
      qc.invalidateQueries({ queryKey: ["question-bank-summary"] })
    },
  })

  async function approveAll() {
    for (const q of pending) {
      if (!actioned.has(q.id)) {
        mutate({ id: q.id, action: "approve" })
        await new Promise((r) => setTimeout(r, 80))
      }
    }
  }

  const visible = pending.filter((q) => !actioned.has(q.id))

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
      </div>
    )
  }

  if (visible.length === 0 && actioned.size === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <BookOpen className="size-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">No questions pending review</p>
          <p className="text-sm text-muted-foreground">Generate questions from your documents to get started.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/tests/generate")}>
          Generate questions
        </Button>
      </div>
    )
  }

  if (visible.length === 0 && actioned.size > 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <div>
          <p className="font-semibold">All done!</p>
          <p className="text-sm text-muted-foreground">Head to the test builder to create a test.</p>
        </div>
        <Button onClick={() => router.push("/tests/builder")}>Build a test</Button>
      </div>
    )
  }

  const asEditable = (q: Question): EditableQuestion => ({
    ...q,
    editing: false,
    draft: {
      question_text: q.question_text,
      options: q.options as QuestionOption[],
      explanation: q.explanation ?? "",
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review questions</h1>
          <p className="text-muted-foreground">
            {visible.length} question{visible.length !== 1 ? "s" : ""} pending review
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={approveAll} disabled={isPending}>
          <CheckCircle2 className="mr-1.5 size-3.5" /> Approve all
        </Button>
      </div>

      <AnimatePresence>
        <div className="space-y-3">
          {visible.map((q) => (
            <motion.div
              key={q.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
            >
              <QuestionCard
                q={asEditable(q)}
                isPending={isPending}
                onAction={(id, action, edits) => mutate({ id, action, edits: edits as Parameters<typeof mutate>[0]["edits"] })}
              />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  )
}
