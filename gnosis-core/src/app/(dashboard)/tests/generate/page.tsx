"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Sparkles, FolderOpen, AlertTriangle, Loader2, CheckCircle2, Wand2,
  FileText, ChevronDown, ChevronUp, Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChapterWithStats } from "@/types"

interface ChaptersResponse {
  chapters: ChapterWithStats[]
  total: number
}

function DifficultyPicker({
  easy, medium, hard,
  onEasy, onMedium, onHard,
}: {
  easy: number; medium: number; hard: number
  onEasy: (v: number) => void; onMedium: (v: number) => void; onHard: (v: number) => void
}) {
  const total = easy + medium + hard
  const fields = [
    { label: "Easy",   value: easy,   onChange: onEasy,   color: "text-green-600 dark:text-green-400", border: "focus:border-green-500" },
    { label: "Medium", value: medium, onChange: onMedium, color: "text-amber-500",                     border: "focus:border-amber-400" },
    { label: "Hard",   value: hard,   onChange: onHard,   color: "text-destructive",                   border: "focus:border-destructive" },
  ]

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold">Question difficulty</label>
      <div className="grid grid-cols-3 gap-3">
        {fields.map(({ label, value, onChange, color, border }) => (
          <div key={label} className="space-y-1.5">
            <span className={cn("block text-xs font-semibold", color)}>{label}</span>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className={cn(
                "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-ring/30 tabular-nums",
                border
              )}
            />
          </div>
        ))}
      </div>
      <p className={cn("text-center text-sm tabular-nums", total === 0 ? "text-muted-foreground" : "font-medium")}>
        Total: <span className="font-bold">{total}</span> question{total !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

function BlendControl({
  value,
  locked,
  lockMessage,
  onChange,
}: {
  value: number
  locked: boolean
  lockMessage?: string
  onChange: (v: number) => void
}) {
  const docPct = 100 - value

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">
          Prompt blend
          {locked && <span className="ml-2 text-xs text-muted-foreground font-normal">({lockMessage ?? "locked"})</span>}
        </label>
        <span className="text-sm font-bold tabular-nums text-primary">{value}%</span>
      </div>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          disabled={locked}
          onChange={(e) => {
            const n = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0))
            onChange(n)
          }}
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50 tabular-nums"
        />
      </div>
      {!locked && (
        <div className="flex gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            {value}% from custom prompt
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            {docPct}% from chapter documents
          </div>
        </div>
      )}
    </div>
  )
}

export default function GeneratePage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [prompt, setPrompt] = useState("")
  const [promptPct, setPromptPct] = useState(100)
  const [easyCount, setEasyCount] = useState(12)
  const [mediumCount, setMediumCount] = useState(6)
  const [hardCount, setHardCount] = useState(2)
  const [threshold, setThreshold] = useState(20)
  const [chaptersExpanded, setChaptersExpanded] = useState(true)

  const [loading, setLoading] = useState(false)
  const [suggestingName, setSuggestingName] = useState(false)
  const [submitted, setSubmitted] = useState<"completed" | "pending_admin" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasChapters = selectedChapters.length > 0
  const hasPrompt = Boolean(prompt.trim())
  const promptLocked = !hasChapters
  const blendLocked = promptLocked || !hasPrompt
  const questionCount = easyCount + mediumCount + hardCount
  const needsApproval = questionCount > threshold

  // Lock prompt to 100% when no chapters; set default 20% when chapters first selected
  useEffect(() => {
    if (!hasChapters) {
      setPromptPct(100)
    } else if (promptPct === 100) {
      setPromptPct(20)
    }
  }, [hasChapters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Force blend to 0 when prompt is cleared; restore default when prompt is first entered
  useEffect(() => {
    if (!hasChapters) return
    if (!hasPrompt) {
      setPromptPct(0)
    } else if (promptPct === 0) {
      setPromptPct(20)
    }
  }, [hasPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user's chapters
  const { data: chaptersData, isLoading: chaptersLoading } = useQuery<ChaptersResponse>({
    queryKey: ["chapters", 1],
    queryFn: async () => {
      const res = await fetch("/api/educator/chapters?page=1")
      if (!res.ok) throw new Error(`${res.status}`)
      return res.json()
    },
  })

  // Fetch per-user threshold from platform settings
  useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings")
      if (!res.ok) return null
      const data = await res.json()
      if (data?.settings?.question_approval_threshold) {
        setThreshold(data.settings.question_approval_threshold)
      }
      return data
    },
  })

  const chapters = chaptersData?.chapters ?? []

  const toggleChapter = useCallback((id: string) => {
    setSelectedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }, [])

  async function handleSuggestName() {
    if (selectedChapters.length === 0) return
    setSuggestingName(true)
    try {
      const res = await fetch("/api/educator/tests/generate/suggest-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_ids: selectedChapters, prompt: prompt.trim() || undefined }),
      })
      const d = await res.json()
      if (d.name) setName(d.name)
    } finally {
      setSuggestingName(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setError("Test name is required.")
      return
    }
    if (!hasChapters && !prompt.trim()) {
      setError("Select at least one chapter or enter a custom prompt.")
      return
    }
    if (questionCount === 0) {
      setError("Add at least one question across Easy, Medium, or Hard.")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/educator/tests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          chapter_ids: selectedChapters,
          prompt: prompt.trim(),
          prompt_pct: promptLocked ? 100 : promptPct,
          easy_count: easyCount,
          medium_count: mediumCount,
          hard_count: hardCount,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Generation failed.")
        return
      }

      setSubmitted(json.status)
      if (json.status === "completed") {
        const dest = json.test_id ? `/tests/${json.test_id}/review` : "/tests/review"
        setTimeout(() => router.push(dest), 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  if (submitted === "pending_admin") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-10 text-center">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/10">
            <AlertTriangle className="size-8 text-amber-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold">Request submitted for review</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Requests over {threshold} questions require admin approval. You'll be notified once reviewed.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/tests")}>Back to tests</Button>
      </div>
    )
  }

  if (submitted === "completed") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-10 text-center">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-green-500/10">
            <CheckCircle2 className="size-8 text-green-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold">Questions generated!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Redirecting to the review screen…</p>
        </div>
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generate test</h1>
        <p className="text-muted-foreground text-sm">
          Select chapters, blend your prompt, set toughness, and generate questions in one step.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── 1. Test Name ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">
            Test name <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chapter 5 — Skeletal System"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasChapters || suggestingName}
              onClick={handleSuggestName}
              className="gap-1.5 shrink-0"
              title="Suggest name based on selected chapters"
            >
              {suggestingName ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              Suggest
            </Button>
          </div>
        </section>

        {/* ── 2. Chapter Selection ─────────────────────────────────── */}
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setChaptersExpanded((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold cursor-pointer">
                Chapters
                {hasChapters && (
                  <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {selectedChapters.length}
                  </span>
                )}
              </label>
              <span className="text-xs text-muted-foreground">(optional if prompt provided)</span>
            </div>
            {chaptersExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </button>

          {chaptersExpanded && (
            <>
              {chaptersLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}
                </div>
              ) : chapters.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <FolderOpen className="mx-auto mb-2 size-7 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No chapters yet.{" "}
                    <a href="/chapters" className="text-primary underline-offset-4 hover:underline">Create one</a>
                    {" "}and upload documents to use them here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {chapters.map((chapter) => {
                    const checked = selectedChapters.includes(chapter.id)
                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => toggleChapter(chapter.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        )}>
                          {checked && <CheckCircle2 className="size-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{chapter.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <FileText className="size-3" /> {chapter.doc_count} doc{chapter.doc_count !== 1 ? "s" : ""}
                            </span>
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── 3. Prompt & Blend ────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <label className="text-sm font-semibold">Custom prompt</label>
            <span className="ml-2 text-xs text-muted-foreground">
              {hasChapters ? "(optional)" : "(required — no chapters selected)"}
            </span>
          </div>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. photosynthesis and light-dependent reactions, quadratic equations…"
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
          />
          <BlendControl
            value={promptLocked ? 100 : !hasPrompt ? 0 : promptPct}
            locked={blendLocked}
            lockMessage={promptLocked ? "locked — no chapters selected" : "locked — enter a prompt to enable"}
            onChange={setPromptPct}
          />
          {hasChapters && promptPct === 0 && !prompt.trim() && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              All questions will come from chapter documents. Enter a prompt to blend in custom questions.
            </div>
          )}
        </section>

        {/* ── 4. Difficulty Picker ─────────────────────────────────── */}
        <section className="space-y-3">
          <DifficultyPicker
            easy={easyCount} medium={mediumCount} hard={hardCount}
            onEasy={setEasyCount} onMedium={setMediumCount} onHard={setHardCount}
          />
          {needsApproval && questionCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Requests over {threshold} questions require admin approval before generation runs.
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/tests")}>Cancel</Button>
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? (
              <><Loader2 className="size-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="size-4" /> {needsApproval ? "Submit for approval" : "Generate"}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
