"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Check, X } from "lucide-react"

interface MilestonePreview {
  node_id: string
  node_level: string
  node_title: string
  month: number
  week_in_month: number
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

interface NlpInputProps {
  planId: string
  onApply: (milestones: MilestonePreview[]) => void
}

export function NlpInput({ planId, onApply }: NlpInputProps) {
  const [instruction, setInstruction] = useState("")
  const [preview, setPreview] = useState<MilestonePreview[] | null>(null)
  const [error, setError] = useState("")

  const { mutate: parse, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/educator/pacing/${planId}/nlp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      return res.json()
    },
    onSuccess: (data) => { setPreview(data.milestones); setError("") },
    onError: (err: Error) => { setError(err.message); setPreview(null) },
  })

  function handleApply() {
    if (!preview) return
    onApply(preview)
    setPreview(null)
    setInstruction("")
  }

  // Summarize preview by chapter only (for display)
  const chapterPreviews = preview?.filter(m => m.node_level === "chapter") ?? []

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary shrink-0" />
        <span className="text-sm font-medium">Natural Language Scheduling</span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && instruction.trim()) parse() }}
          placeholder='e.g. "Assign Chapters 1–3 to March, one per week"'
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <Button size="sm" disabled={isPending || !instruction.trim()} onClick={() => parse()}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Parse"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {preview && preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Preview — {chapterPreviews.length} chapter{chapterPreviews.length !== 1 ? "s" : ""} ({preview.length} nodes total) will be scheduled:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chapterPreviews.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                W{m.week_in_month} · {MONTH_SHORT[m.month - 1]} — {m.node_title}
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="gap-1.5" onClick={handleApply}>
              <Check className="size-3.5" /> Apply
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setPreview(null)}>
              <X className="size-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
