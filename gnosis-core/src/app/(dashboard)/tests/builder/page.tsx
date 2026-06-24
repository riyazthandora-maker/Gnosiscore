"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { BookOpen, CheckCircle2, Loader2, Search, Filter, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Question, Difficulty } from "@/types"

const DIFFICULTIES: (Difficulty | "all")[] = ["all", "easy", "medium", "hard"]

export default function BuilderPage() {
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [filterDiff, setFilterDiff] = useState<Difficulty | "all">("all")
  const [selectedGenId, setSelectedGenId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [timeLimit, setTimeLimit] = useState<string>("")
  const [allowPause, setAllowPause] = useState(false)
  const [suggestingName, setSuggestingName] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSuggestName() {
    if (selected.size === 0) return
    setSuggestingName(true)
    try {
      const res = await fetch("/api/educator/tests/suggest-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_ids: Array.from(selected) }),
      })
      const d = await res.json()
      if (d.name) setTitle(d.name)
    } finally {
      setSuggestingName(false)
    }
  }

  const { data, isLoading } = useQuery<{
    questions: (Question & { generation_request_id: string | null })[]
    total: number
    generations: { id: string; name: string; created_at: string }[]
  }>({
    queryKey: ["question-bank-summary"],
    queryFn: () => fetch("/api/educator/questions?summary=1").then((r) => r.json()),
  })

  const approved = data?.questions ?? []
  const generations = data?.generations ?? []
  // Default to the latest generation (first in desc-sorted list); fall back to "all" if none
  const activeGenId = selectedGenId ?? generations[0]?.id ?? null

  const filtered = useMemo(() => {
    return approved.filter((q) => {
      const matchGen = !activeGenId || q.generation_request_id === activeGenId
      const matchSearch = !search || q.question_text.toLowerCase().includes(search.toLowerCase()) ||
        q.topic_tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      const matchDiff = filterDiff === "all" || q.difficulty === filterDiff
      return matchGen && matchSearch && matchDiff
    })
  }, [approved, activeGenId, search, filterDiff])

  function toggleQuestion(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map((q) => q.id)))
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!title.trim()) throw new Error("Test title is required.")
      if (selected.size === 0) throw new Error("Select at least one question.")

      const res = await fetch("/api/educator/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          question_ids: Array.from(selected),
          time_limit_min: timeLimit ? parseInt(timeLimit) : undefined,
          allow_pause: allowPause,
          is_published: publish,
        }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: ({ test }) => {
      router.push(`/tests/${test.id}`)
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Failed to create test.")
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
      </div>
    )
  }

  if (approved.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <BookOpen className="size-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">No approved questions yet</p>
          <p className="text-sm text-muted-foreground">Generate and review questions before building a test.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/tests/generate")}>
          Generate questions
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Build a test</h1>
        <p className="text-muted-foreground">Choose questions from your bank, set a title, and save.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
        {/* Question bank */}
        <section className="space-y-3">
          {generations.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Question batch</label>
              <select
                value={activeGenId ?? ""}
                onChange={(e) => setSelectedGenId(e.target.value || null)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">All batches</option>
                {generations.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 self-start sm:self-auto">
              <Filter className="ml-1 size-3.5 text-muted-foreground" />
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDiff(d)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    filterDiff === d ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} questions</span>
            <button
              type="button"
              onClick={selectAll}
              className="hover:text-foreground transition-colors"
            >
              Select all visible
            </button>
          </div>

          <div className="max-h-[500px] space-y-2 overflow-y-auto">
            {filtered.map((q) => {
              const checked = selected.has(q.id)
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => toggleQuestion(q.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  )}>
                    {checked && <CheckCircle2 className="size-3" />}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm">{q.question_text}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{q.difficulty}</span>
                      {q.topic_tags.length > 0 && <span>· {q.topic_tags[0]}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Test config */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <p className="text-sm font-semibold">Test details</p>
            <p className="text-xs text-muted-foreground">{selected.size} question{selected.size !== 1 ? "s" : ""} selected</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Title *</label>
              <div className="flex gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 3 Quiz"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selected.size === 0 || suggestingName}
                  onClick={handleSuggestName}
                  className="shrink-0 px-2"
                  title="Suggest a name based on selected questions"
                >
                  {suggestingName ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional instructions for students"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Time limit (min)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                placeholder="No limit"
                min={1}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowPause}
                onChange={(e) => setAllowPause(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              <div>
                <p className="text-xs font-medium">Allow pause</p>
                <p className="text-xs text-muted-foreground">Students can pause the exam timer.</p>
              </div>
            </label>
          </div>

          {formError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{formError}</p>
          )}

          <div className="space-y-2 pt-1">
            <Button
              className="w-full gap-2 text-sm"
              disabled={isPending || selected.size === 0}
              onClick={() => { setFormError(null); mutate(false) }}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save as draft
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 text-sm"
              disabled={isPending || selected.size === 0}
              onClick={() => { setFormError(null); mutate(true) }}
            >
              Save &amp; publish
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
