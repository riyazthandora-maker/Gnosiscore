"use client"

import { useState } from "react"
import { Search, FileText, CheckSquare, Square } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExamSummary {
  id: string
  title: string
  created_at: string
  question_count: number
}

interface ExamSelectPanelProps {
  exams: ExamSummary[]
  selected: Set<string>
  onToggle: (id: string) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function ExamSelectPanel({ exams, selected, onToggle }: ExamSelectPanelProps) {
  const [query, setQuery] = useState("")

  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(query.toLowerCase()) ||
    formatDate(e.created_at).toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search exams…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
        />
      </div>

      {exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed border-border text-center">
          <FileText className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No exams yet. Generate one first.</p>
        </div>
      )}

      {exams.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No exams match &ldquo;{query}&rdquo;</p>
      )}

      <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
        {filtered.map(e => {
          const checked = selected.has(e.id)
          return (
            <button
              key={e.id}
              onClick={() => onToggle(e.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                checked
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-card hover:bg-accent"
              )}
            >
              {checked
                ? <CheckSquare className="size-4 shrink-0 text-primary" />
                : <Square className="size-4 shrink-0 text-muted-foreground" />
              }
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(e.created_at)} · {e.question_count} questions</p>
              </div>
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <p className="text-xs text-primary font-medium">
          {selected.size} exam{selected.size !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  )
}
