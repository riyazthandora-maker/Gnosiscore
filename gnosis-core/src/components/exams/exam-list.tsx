"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText, Search, Send } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExamSummary {
  id: string
  title: string
  created_at: string
  question_count: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  })
}

export function ExamList({ exams }: { exams: ExamSummary[] }) {
  const [query, setQuery] = useState("")

  const filtered = exams.filter(e =>
    e.title.toLowerCase().includes(query.toLowerCase()) ||
    formatDate(e.created_at).toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Search by name or date…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
        />
      </div>

      {/* Empty states */}
      {exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border border-dashed border-border text-center">
          <FileText className="size-8 text-muted-foreground/50" />
          <p className="font-medium">No exams yet</p>
          <p className="text-sm text-muted-foreground">Generate your first exam to see it here.</p>
        </div>
      )}

      {exams.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground">No exams match &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {/* List */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map(e => (
            <div
              key={e.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
            >
              <Link
                href={`/exams/${e.id}`}
                className={cn("flex-1 min-w-0 hover:opacity-80 transition-opacity")}
              >
                <p className="font-medium text-sm truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(e.created_at)}</p>
              </Link>
              <div className="shrink-0 text-xs text-muted-foreground">
                {e.question_count} question{e.question_count !== 1 ? "s" : ""}
              </div>
              <Link
                href={`/exams/assign?exam_id=${e.id}`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                <Send className="size-3" />
                Assign
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
