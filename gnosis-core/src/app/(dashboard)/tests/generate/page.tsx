"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Sparkles, FileText, AlertTriangle, Loader2, CheckCircle2, Clock, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Document, Difficulty } from "@/types"
import { GENERATION_ADMIN_THRESHOLD } from "@/types"

const DIFFICULTIES: { value: Difficulty; label: string; desc: string }[] = [
  { value: "easy",   label: "Easy",   desc: "Recall & recognition" },
  { value: "medium", label: "Medium", desc: "Application & interpretation" },
  { value: "hard",   label: "Hard",   desc: "Analysis & synthesis" },
]

export default function GeneratePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedDocId = searchParams.get("docId")

  const [name, setName] = useState("")
  const [selectedDocs, setSelectedDocs] = useState<string[]>(preselectedDocId ? [preselectedDocId] : [])
  const [prompt, setPrompt] = useState("")
  const [questionCount, setQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [loading, setLoading] = useState(false)
  const [suggestingName, setSuggestingName] = useState(false)
  const [submitted, setSubmitted] = useState<"completed" | "pending_admin" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSuggestName() {
    if (selectedDocs.length === 0) return
    setSuggestingName(true)
    try {
      const res = await fetch("/api/educator/questions/suggest-bank-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: selectedDocs }),
      })
      const d = await res.json()
      if (d.name) setName(d.name)
    } finally {
      setSuggestingName(false)
    }
  }

  const { data: allDocs = [], isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: () => fetch("/api/documents").then((r) => r.json()).then((j) => j.documents ?? []),
  })

  const { data: promptsData } = useQuery<{ prompts: string[] }>({
    queryKey: ["educator-prompts"],
    queryFn: () => fetch("/api/educator/prompts").then((r) => r.json()),
  })

  // 10 most recent ready documents
  const readyDocs = allDocs
    .filter((d) => d.processing_status === "ready")
    .slice(0, 10)

  const recentPrompts = promptsData?.prompts ?? []
  const needsApproval = selectedDocs.length > 0 && questionCount > GENERATION_ADMIN_THRESHOLD

  function toggleDoc(id: string) {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setError("A generation name is required.")
      return
    }

    const hasDocs = selectedDocs.length > 0
    const hasPrompt = prompt.trim().length > 0

    if (!hasDocs && !hasPrompt) {
      setError("Select at least one document or enter a topic / prompt.")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/educator/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(hasDocs ? { documentIds: selectedDocs } : {}),
          ...(hasPrompt ? { prompt: prompt.trim() } : {}),
          questionCount,
          difficulty,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Generation failed.")
        return
      }

      setSubmitted(json.status)
      if (json.status === "completed") {
        setTimeout(() => router.push("/tests/review"), 1500)
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
            Requests over {GENERATION_ADMIN_THRESHOLD} questions require admin approval.
            You'll be notified once it's reviewed — usually within a few hours.
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
        <h1 className="text-2xl font-bold tracking-tight">Generate questions</h1>
        <p className="text-muted-foreground">
          Provide a document, a topic prompt, or both — at least one is required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Generation name ─────────────────────────────────────── */}
        <section className="space-y-2">
          <label className="text-sm font-semibold">
            Generation name <span className="text-destructive">*</span>
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
              disabled={selectedDocs.length === 0 || suggestingName}
              onClick={handleSuggestName}
              className="gap-1.5 shrink-0"
              title="Suggest a name based on selected documents"
            >
              {suggestingName ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              Suggest
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Used to identify this batch of questions in the test builder.</p>
        </section>

        {/* ── Topic / Prompt ──────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <label className="text-sm font-semibold">Topic or prompt</label>
            <span className="ml-2 text-xs text-muted-foreground">(required if no document selected)</span>
          </div>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. photosynthesis and the light-dependent reactions, World War II causes, algebra linear equations…"
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
          />

          {/* Recent prompts */}
          {recentPrompts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> Recent
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      prompt === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    {p.length > 60 ? p.slice(0, 57) + "…" : p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Source documents ────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <label className="text-sm font-semibold">Source documents</label>
            <span className="ml-2 text-xs text-muted-foreground">(required if no topic entered · 10 most recent)</span>
          </div>
          {docsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : readyDocs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <FileText className="mx-auto mb-2 size-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No ready documents — upload and process one first, or use a prompt above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {readyDocs.map((doc) => {
                const checked = selectedDocs.includes(doc.id)
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleDoc(doc.id)}
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
                      <p className="truncate text-sm font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.chunk_count ?? 0} chunks · {(doc.total_bytes / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Difficulty ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <label className="text-sm font-semibold">Difficulty</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {DIFFICULTIES.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  difficulty === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Question count ──────────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Number of questions</label>
            <span className={cn(
              "text-sm font-bold tabular-nums",
              needsApproval ? "text-amber-500" : "text-foreground"
            )}>
              {questionCount}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>50</span>
          </div>
          {needsApproval && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Requests over {GENERATION_ADMIN_THRESHOLD} questions require admin approval before generation runs.
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/tests")}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="gap-2">
            {loading
              ? <><Loader2 className="size-4 animate-spin" /> Generating…</>
              : <><Sparkles className="size-4" /> {needsApproval ? "Submit for approval" : "Generate"}</>
            }
          </Button>
        </div>
      </form>
    </div>
  )
}
