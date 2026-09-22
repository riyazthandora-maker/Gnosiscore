"use client"

import { useState } from "react"
import { Calendar, ChevronRight, Lightbulb, RefreshCw, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PacingSuggestion {
  id: string
  suggestion_type: "reschedule" | "insert_revise"
  status: "pending" | "applied" | "dismissed"
  ai_reasoning: string | null
  payload: {
    moves?: Array<{
      node_title: string
      from_month: number
      from_week: number
      to_month: number
      to_week: number
    }>
    inserts?: Array<{
      node_title: string
      insert_month: number
      insert_week: number
    }>
  }
  created_at: string
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function slotLabel(month: number, week: number) {
  return `W${week} ${MONTH_SHORT[month - 1]}`
}

export function SuggestionsPanel({
  planId,
  suggestions: initialSuggestions,
  onApplied,
}: {
  planId: string
  suggestions: PacingSuggestion[]
  onApplied: (updatedMilestones: unknown[]) => void
}) {
  const [suggestions, setSuggestions] = useState<PacingSuggestion[]>(initialSuggestions)
  const [acting, setActing] = useState<Record<string, "applying" | "dismissing">>({})

  async function act(id: string, action: "apply" | "dismiss") {
    setActing(prev => ({ ...prev, [id]: action === "apply" ? "applying" : "dismissing" }))

    const res = await fetch(`/api/educator/pacing/${planId}/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })

    setActing(prev => { const next = { ...prev }; delete next[id]; return next })
    if (!res.ok) return

    const data = await res.json()
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, status: action === "apply" ? "applied" : "dismissed" } : s)
    )
    if (action === "apply" && data.milestones) {
      onApplied(data.milestones)
    }
  }

  const pending = suggestions.filter(s => s.status === "pending")
  if (pending.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {pending.map(s => (
        <div
          key={s.id}
          className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-2.5">
            <div className={cn(
              "shrink-0 mt-0.5 rounded-md p-1.5",
              s.suggestion_type === "reschedule"
                ? "bg-blue-100 text-blue-700"
                : "bg-amber-100 text-amber-700"
            )}>
              {s.suggestion_type === "reschedule"
                ? <Calendar className="size-3.5" />
                : <Lightbulb className="size-3.5" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground mb-0.5">
                {s.suggestion_type === "reschedule" ? "Rescheduling suggestion" : "Remediation suggestion"}
              </p>
              {s.ai_reasoning && (
                <p className="text-xs text-muted-foreground leading-relaxed">{s.ai_reasoning}</p>
              )}
            </div>
          </div>

          {/* Reschedule moves preview */}
          {s.suggestion_type === "reschedule" && (s.payload.moves ?? []).length > 0 && (
            <div className="flex flex-col gap-1 pl-9">
              {s.payload.moves!.map((move, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground min-w-0 truncate">{move.node_title}</span>
                  <span className="shrink-0">{slotLabel(move.from_month, move.from_week)}</span>
                  <ChevronRight className="size-3 shrink-0" />
                  <span className="shrink-0 font-medium text-blue-700">{slotLabel(move.to_month, move.to_week)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Remediation inserts preview */}
          {s.suggestion_type === "insert_revise" && (s.payload.inserts ?? []).length > 0 && (
            <div className="flex flex-col gap-1 pl-9">
              {s.payload.inserts!.map((ins, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-amber-700 min-w-0 truncate">+ {ins.node_title}</span>
                  <span className="text-muted-foreground shrink-0">at {slotLabel(ins.insert_month, ins.insert_week)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pl-9">
            <button
              disabled={!!acting[s.id]}
              onClick={() => act(s.id, "apply")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {acting[s.id] === "applying"
                ? <RefreshCw className="size-3 animate-spin" />
                : <Check className="size-3" />
              }
              {acting[s.id] === "applying" ? "Applying…" : "Apply"}
            </button>
            <button
              disabled={!!acting[s.id]}
              onClick={() => act(s.id, "dismiss")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            >
              <X className="size-3" />
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
