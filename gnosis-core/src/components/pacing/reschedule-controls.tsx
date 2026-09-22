"use client"

import { useState } from "react"
import { CalendarCheck, Brain } from "lucide-react"
import { SuggestionsPanel, type PacingSuggestion } from "./suggestions-panel"

export function RescheduleControls({
  planId,
  onApplied,
}: {
  planId: string
  onApplied: (updatedMilestones: unknown[]) => void
}) {
  const [rescheduling, setRescheduling] = useState(false)
  const [remediating, setRemediating]   = useState(false)
  const [message, setMessage]           = useState("")
  const [suggestions, setSuggestions]   = useState<PacingSuggestion[]>([])

  async function checkReschedule() {
    setRescheduling(true)
    setMessage("")
    const res  = await fetch(`/api/educator/pacing/${planId}/reschedule`, { method: "POST" })
    const data = await res.json()
    setRescheduling(false)
    if (!res.ok) { setMessage(data.error ?? "Failed to check rescheduling."); return }
    if (data.suggestion) {
      setSuggestions(prev => [data.suggestion as PacingSuggestion, ...prev.filter(s => s.id !== (data.suggestion as PacingSuggestion).id)])
    } else {
      setMessage(data.message ?? "No rescheduling needed.")
    }
  }

  async function checkRemediation() {
    setRemediating(true)
    setMessage("")
    const res  = await fetch(`/api/educator/pacing/${planId}/remediation`, { method: "POST" })
    const data = await res.json()
    setRemediating(false)
    if (!res.ok) { setMessage(data.error ?? "Failed to check remediation."); return }
    if (data.suggestion) {
      setSuggestions(prev => [data.suggestion as PacingSuggestion, ...prev.filter(s => s.id !== (data.suggestion as PacingSuggestion).id)])
    } else {
      setMessage(data.message ?? "No remediation needed.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={rescheduling || remediating}
          onClick={checkReschedule}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <CalendarCheck className="size-3.5" />
          {rescheduling ? "Checking…" : "Check Rescheduling"}
        </button>
        <button
          disabled={rescheduling || remediating}
          onClick={checkRemediation}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <Brain className="size-3.5" />
          {remediating ? "Checking…" : "Check Remediation"}
        </button>
      </div>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      {suggestions.length > 0 && (
        <SuggestionsPanel
          planId={planId}
          suggestions={suggestions}
          onApplied={milestones => {
            onApplied(milestones)
            setSuggestions(prev => prev.filter(s => s.status === "pending"))
          }}
        />
      )}
    </div>
  )
}
