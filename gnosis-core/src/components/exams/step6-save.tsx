"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWizard } from "@/components/exams/wizard-context"

type SaveStatus = "idle" | "saving" | "saved" | "error"
type SuggestStatus = "idle" | "loading" | "done" | "error"

function formatDateTime(): string {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(",", "")
}

export function Step6Save() {
  const router = useRouter()
  const { books, selectedNodeIds, weightages, settings, questions, title, setTitle, goBack } = useWizard()

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [suggestStatus, setSuggestStatus] = useState<SuggestStatus>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const hasSuggested = useRef(false)

  // Auto-suggest on mount
  useEffect(() => {
    if (hasSuggested.current || title.trim()) return
    hasSuggested.current = true
    suggestTitle()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function suggestTitle() {
    setSuggestStatus("loading")
    try {
      const res = await fetch("/api/educator/exams/suggest-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed")
      const suggested = `${data.title} — ${formatDateTime()}`
      setTitle(suggested)
      setSuggestStatus("done")
    } catch {
      setSuggestStatus("error")
      // Pre-fill with a safe default so the user can still save
      if (!title.trim()) setTitle(`Exam Paper — ${formatDateTime()}`)
    }
  }

  async function save() {
    if (!title.trim()) return
    setSaveStatus("saving")
    setErrorMsg("")

    // Build source_meta from wizard state
    const source_meta = {
      books: books.map(b => ({
        id: b.id,
        title: b.title,
        selected_blocks: b.blocks
          .filter(bl => selectedNodeIds.has(bl.id))
          .map(bl => ({ id: bl.id, level: bl.level, text: bl.text })),
      })),
      weightages,
      settings,
    }

    try {
      const res = await fetch("/api/educator/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), questions, source_meta }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      setSaveStatus("saved")
      setTimeout(() => router.push("/exams"), 1200)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error")
      setSaveStatus("error")
    }
  }

  const easy = questions.filter(q => q.difficulty === "easy").length
  const hard = questions.filter(q => q.difficulty === "hard").length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Name &amp; Save</h2>
        <p className="text-sm text-muted-foreground">
          Give your exam a title and save it to your library.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 flex flex-wrap gap-5 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Questions</span>
          <span className="font-semibold">{questions.length}</span>
        </div>
        <div className="w-px bg-border self-stretch" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Easy</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{easy}</span>
        </div>
        <div className="w-px bg-border self-stretch" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Hard</span>
          <span className="font-semibold text-orange-600 dark:text-orange-400">{hard}</span>
        </div>
        <div className="w-px bg-border self-stretch" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Sources</span>
          <span className="font-semibold">{books.length} book{books.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Title input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Exam title</label>
          <button
            onClick={suggestTitle}
            disabled={suggestStatus === "loading"}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {suggestStatus === "loading"
              ? <Loader2 className="size-3 animate-spin" />
              : <Sparkles className="size-3" />}
            {suggestStatus === "loading" ? "Suggesting…" : "Re-suggest"}
          </button>
        </div>

        <div className="relative">
          {suggestStatus === "loading" && (
            <div className="absolute inset-0 rounded-lg bg-background/60 flex items-center justify-center z-10">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Fractions and Decimals Quiz — 30 Aug 2026 11:00"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Title must be unique across your exams. Date &amp; time is appended automatically.
        </p>
      </div>

      {/* Error message */}
      {saveStatus === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Saved confirmation */}
      {saveStatus === "saved" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Saved! Redirecting to your exams…</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={goBack} disabled={saveStatus === "saving" || saveStatus === "saved"}>
          Back
        </Button>
        <Button
          onClick={save}
          disabled={!title.trim() || saveStatus === "saving" || saveStatus === "saved"}
          className="gap-2 min-w-36"
        >
          {saveStatus === "saving" ? (
            <><Loader2 className="size-4 animate-spin" /> Saving…</>
          ) : saveStatus === "saved" ? (
            <><CheckCircle2 className="size-4" /> Saved</>
          ) : (
            <><Save className="size-4" /> Save Exam Paper</>
          )}
        </Button>
      </div>
    </div>
  )
}
