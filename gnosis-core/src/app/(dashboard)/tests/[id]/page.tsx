"use client"

import { useState } from "react"
import { use } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { BookOpen, Clock, Users, Pencil, Trash2, Loader2, CheckCircle2, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Test, Question, QuestionOption } from "@/types"

interface TestDetail extends Test {
  questions: (Question & { options: QuestionOption[] })[]
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso))
}

export default function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [timeLimit, setTimeLimit] = useState<string>("")

  const { data, isLoading } = useQuery<{ test: TestDetail }>({
    queryKey: ["test-detail", id],
    queryFn: () => fetch(`/api/educator/tests/${id}`).then((r) => r.json()),
  })

  const test = data?.test

  function startEditing() {
    if (!test) return
    setTitle(test.title)
    setDescription(test.description ?? "")
    setTimeLimit(test.time_limit_min?.toString() ?? "")
    setEditing(true)
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/educator/tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-detail", id] })
      qc.invalidateQueries({ queryKey: ["educator-tests"] })
      setEditing(false)
    },
  })

  const { mutate: del, isPending: deleting } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/educator/tests/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) { const { error } = await res.json(); throw new Error(error) }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["educator-tests"] })
      router.push("/tests")
    },
  })

  if (isLoading || !test) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2 text-xl font-bold outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        ) : (
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{test.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{test.question_ids.length} questions</span>
              {test.time_limit_min && (
                <span className="flex items-center gap-1"><Clock className="size-3.5" />{test.time_limit_min} min</span>
              )}
              <span>Created {formatDate(test.created_at)}</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                test.is_published
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {test.is_published ? <><CheckCircle2 className="size-3" />Published</> : "Draft"}
              </span>
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => save({
                  title: title.trim(),
                  description: description.trim() || null,
                  time_limit_min: timeLimit ? parseInt(timeLimit) : null,
                })}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
            </>
          ) : (
            <>
              {!test.is_published && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => save({ is_published: true })}
                  disabled={saving}
                >
                  <Globe className="size-3.5" /> Publish
                </Button>
              )}
              <Link href={`/tests/${id}/assign`}>
                <Button size="sm" className="gap-1.5">
                  <Users className="size-3.5" /> Assign
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={startEditing}>
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm("Delete this test?")) del() }}
                disabled={deleting}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Description edit */}
      {editing && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Time limit (minutes)</label>
            <input
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
      )}

      {/* Description display */}
      {!editing && test.description && (
        <p className="text-sm text-muted-foreground">{test.description}</p>
      )}

      {/* Questions list */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Questions</h2>
        {test.questions.map((q, idx) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-sm font-bold text-muted-foreground tabular-nums w-6">{idx + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{q.question_text}</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {(q.options as QuestionOption[]).map((opt) => (
                    <div
                      key={opt.label}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1 text-xs",
                        opt.is_correct
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 font-medium"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span className="font-bold">{opt.label}.</span>
                      <span className="truncate">{opt.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{q.difficulty}</span>
                  {q.topic_tags.length > 0 && <span>· {q.topic_tags[0]}</span>}
                  {q.explanation && (
                    <span className="truncate max-w-xs">· {q.explanation}</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      <div className="flex justify-center">
        <Link href="/tests" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          <BookOpen className="mr-1.5 inline size-3.5" />Back to tests
        </Link>
      </div>
    </div>
  )
}
