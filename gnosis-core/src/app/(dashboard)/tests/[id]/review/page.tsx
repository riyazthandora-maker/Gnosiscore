"use client"

import { use, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2, Trash2, ChevronDown, ChevronUp, Loader2, BookOpen, Flag, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { QuestionOption } from "@/types"

interface ReviewQuestion {
  id: string
  question_text: string
  options: QuestionOption[]
  explanation: string | null
  difficulty: string | null
  difficulty_weight: number
  topic_tags: string[]
  status: string
}

interface TestReviewData {
  questions: ReviewQuestion[]
  is_published: boolean
  title: string
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({
  q,
  index,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  q: ReviewQuestion
  index: number
  onSave: (id: string, edits: Partial<ReviewQuestion>) => void
  onDelete: (id: string) => void
  isSaving: boolean
  isDeleting: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [text, setText] = useState(q.question_text)
  const [options, setOptions] = useState<QuestionOption[]>(q.options as QuestionOption[])
  const [explanation, setExplanation] = useState(q.explanation ?? "")
  const [weight, setWeight] = useState(q.difficulty_weight ?? 1.0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const correct = options.find((o) => o.is_correct)?.label ?? "A"
  const isDirty =
    text !== q.question_text ||
    explanation !== (q.explanation ?? "") ||
    weight !== (q.difficulty_weight ?? 1.0) ||
    options.some((o, i) => {
      const orig = (q.options as QuestionOption[])[i]
      return o.text !== orig?.text || o.is_correct !== orig?.is_correct
    })

  function setCorrect(label: string) {
    setOptions((prev) => prev.map((o) => ({ ...o, is_correct: o.label === label })))
  }

  function handleSave() {
    onSave(q.id, { question_text: text, options, explanation, difficulty_weight: weight })
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-colors",
      isSaving || isDeleting ? "opacity-70 pointer-events-none" : "border-border"
    )}>
      {/* Card header */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium">
            Q{index + 1}
          </span>
          {q.difficulty && (
            <span className={cn(
              "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize",
              q.difficulty === "easy" ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : q.difficulty === "hard" ? "bg-destructive/10 text-destructive"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}>
              {q.difficulty}
            </span>
          )}
          <p className="truncate text-sm font-medium">{text}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <span className="text-xs text-amber-500 font-medium">Unsaved</span>
          )}
          {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-5 pb-5">
              {/* Question text */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Question</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>

              {/* Options */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Options <span className="font-normal">(tap label to mark correct)</span>
                </label>
                <div className="space-y-2">
                  {options.map((opt) => (
                    <div key={opt.label} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrect(opt.label)}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                          opt.is_correct
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-border text-muted-foreground hover:border-green-400"
                        )}
                      >
                        {opt.label}
                      </button>
                      <input
                        value={opt.text}
                        onChange={(e) =>
                          setOptions((prev) =>
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
                  Correct: <span className="font-semibold text-green-600 dark:text-green-400">{correct}</span>
                </p>
              </div>

              {/* Explanation */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Explanation</label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={2}
                  placeholder="Optional explanation shown after student answers…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
                />
              </div>

              {/* Difficulty weight */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Difficulty weight</label>
                <input
                  type="number"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={weight}
                  onChange={(e) => setWeight(Math.max(0.1, Math.min(5, parseFloat(e.target.value) || 1.0)))}
                  className="w-24 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 tabular-nums"
                />
                <span className="text-xs text-muted-foreground">(1.0 = standard)</span>
              </div>

              {/* Card actions */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive font-medium">Delete this question?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setConfirmDelete(false); onDelete(q.id) }}
                    >
                      {isDeleting ? <Loader2 className="size-3 animate-spin" /> : "Yes, delete"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                )}

                {isDirty && (
                  <Button size="sm" className="text-xs gap-1.5" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    Save changes
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Finalize Dialog ────────────────────────────────────────────────────────────

function FinalizeDialog({
  testTitle,
  questionCount,
  onConfirm,
  onCancel,
  isLoading,
}: {
  testTitle: string
  questionCount: number
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Flag className="size-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Finalize this test?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{testTitle}</span> will be published with{" "}
              <span className="font-medium text-foreground">{questionCount} question{questionCount !== 1 ? "s" : ""}</span>.
              You won't be able to edit questions after finalizing.
            </p>
          </div>
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
              Go back
            </Button>
            <Button className="flex-1 gap-1.5" onClick={onConfirm} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Finalize
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TestReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery<TestReviewData>({
    queryKey: ["test-review", id],
    queryFn: () =>
      fetch(`/api/educator/tests/${id}/questions`).then((r) => {
        if (!r.ok) throw new Error("Failed to load")
        return r.json()
      }),
  })

  const saveMutation = useMutation({
    mutationFn: async ({ qId, edits }: { qId: string; edits: Partial<ReviewQuestion> }) => {
      const res = await fetch(`/api/educator/tests/${id}/questions/${qId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test-review", id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (qId: string) => {
      const res = await fetch(`/api/educator/tests/${id}/questions/${qId}`, { method: "DELETE" })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
    },
    onSuccess: (_data, qId) => {
      setDeletedIds((prev) => new Set(prev).add(qId))
      qc.invalidateQueries({ queryKey: ["test-review", id] })
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/educator/tests/${id}/finalize`, { method: "POST" })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => {
      setShowFinalizeDialog(false)
      router.push("/tests")
    },
  })

  const handleSave = useCallback((qId: string, edits: Partial<ReviewQuestion>) => {
    saveMutation.mutate({ qId, edits })
  }, [saveMutation])

  const handleDelete = useCallback((qId: string) => {
    deleteMutation.mutate(qId)
  }, [deleteMutation])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertTriangle className="size-12 text-muted-foreground/40" />
        <p className="font-semibold">Test not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/tests")}>Back to tests</Button>
      </div>
    )
  }

  if (data.is_published) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <div>
          <p className="font-semibold">This test is already published</p>
          <p className="text-sm text-muted-foreground">{data.title}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/tests")}>Back to tests</Button>
      </div>
    )
  }

  const visible = (data.questions ?? []).filter((q) => !deletedIds.has(q.id))

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <BookOpen className="size-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">No questions remaining</p>
          <p className="text-sm text-muted-foreground">All questions have been deleted.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/tests/generate")}>Generate new test</Button>
      </div>
    )
  }

  return (
    <>
      <AnimatePresence>
        {showFinalizeDialog && (
          <FinalizeDialog
            testTitle={data.title}
            questionCount={visible.length}
            onConfirm={() => finalizeMutation.mutate()}
            onCancel={() => setShowFinalizeDialog(false)}
            isLoading={finalizeMutation.isPending}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-2xl space-y-6 pb-28">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground">
              {visible.length} question{visible.length !== 1 ? "s" : ""} — review and edit before finalizing
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/tests")}>
            Save for later
          </Button>
        </div>

        {/* Question list */}
        <AnimatePresence>
          <div className="space-y-3">
            {visible.map((q, i) => (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
              >
                <QuestionCard
                  q={q}
                  index={i}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  isSaving={saveMutation.isPending && saveMutation.variables?.qId === q.id}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === q.id}
                />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>

        {/* Sticky finalize bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur-sm px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{visible.length}</span> question{visible.length !== 1 ? "s" : ""} ready
            </p>
            <Button className="gap-2" onClick={() => setShowFinalizeDialog(true)}>
              <Flag className="size-4" /> Finalize test
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
