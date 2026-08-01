"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Clock, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type GenStatus = "pending_admin" | "approved" | "rejected" | "completed"
type FilterTab = "pending_admin" | "approved" | "rejected" | "all"

interface GenRequest {
  id: string
  question_count: number
  prompt_context: string | null
  config: Record<string, unknown>
  chapter_ids: string[]
  prompt_pct: number
  toughness: number
  status: GenStatus
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
  users: { full_name: string; email: string } | null
}

function StatusBadge({ status }: { status: GenStatus }) {
  const map: Record<GenStatus, { label: string; cls: string; icon: React.ElementType }> = {
    pending_admin: { label: "Pending",   cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Clock },
    approved:      { label: "Approved",  cls: "bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle2 },
    rejected:      { label: "Rejected",  cls: "bg-destructive/10 text-destructive",                  icon: XCircle },
    completed:     { label: "Completed", cls: "bg-primary/10 text-primary",                          icon: CheckCircle2 },
  }
  const { label, cls, icon: Icon } = map[status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", cls)}>
      <Icon className="size-3" />
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
}

function ActionButtons({ req, onDone }: { req: GenRequest; onDone: () => void }) {
  const [rejectNote, setRejectNote] = useState("")
  const [showReject, setShowReject] = useState(false)

  const { mutate, isPending, variables } = useMutation({
    mutationFn: async ({ action, note }: { action: "approve" | "reject"; note?: string }) => {
      const res = await fetch(`/api/admin/generation-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: onDone,
  })

  if (req.status !== "pending_admin") {
    return req.admin_note ? (
      <p className="text-xs text-muted-foreground italic max-w-xs">Note: {req.admin_note}</p>
    ) : null
  }

  if (showReject) {
    return (
      <div className="flex flex-col gap-2 items-end">
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Reason for rejection (required)"
          rows={2}
          className="w-72 rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowReject(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="text-xs"
            disabled={isPending || !rejectNote.trim()}
            onClick={() => mutate({ action: "reject", note: rejectNote })}
          >
            {isPending && variables?.action === "reject" ? <Loader2 className="size-3 animate-spin" /> : "Confirm reject"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        className="gap-1.5 text-xs"
        disabled={isPending}
        onClick={() => mutate({ action: "approve" })}
      >
        {isPending && variables?.action === "approve"
          ? <Loader2 className="size-3 animate-spin" />
          : <CheckCircle2 className="size-3.5" />}
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={() => setShowReject(true)}
      >
        <XCircle className="size-3.5" />
        Reject
      </Button>
    </div>
  )
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: "pending_admin", label: "Pending" },
  { key: "approved",      label: "Approved" },
  { key: "rejected",      label: "Rejected" },
  { key: "all",           label: "All" },
]

export default function GenerationRequestsPage() {
  const [tab, setTab] = useState<FilterTab>("pending_admin")
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ requests: GenRequest[] }>({
    queryKey: ["admin-gen-requests", tab],
    queryFn: () => fetch(`/api/admin/generation-requests?status=${tab}`).then((r) => r.json()),
    refetchInterval: 30_000,
  })

  const requests = data?.requests ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generation Requests</h1>
        <p className="text-muted-foreground">
          Review high-volume question generation requests (&gt;{20} questions) before execution.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Sparkles className="size-10 text-muted-foreground/40" />
          <p className="font-medium">No requests</p>
          <p className="text-sm text-muted-foreground">
            Requests appear here when an educator asks for more than 20 questions at once.
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {requests.map((req) => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">
                        {req.question_count} questions
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      By: {req.users?.full_name ?? "Unknown"} ({req.users?.email})
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      {Array.isArray(req.chapter_ids) && req.chapter_ids.length > 0 ? (
                        <span>{req.chapter_ids.length} chapter(s) · {req.prompt_pct ?? 0}% prompt · {req.toughness ?? 50}% toughness</span>
                      ) : Boolean(req.config?.difficulty) ? (
                        <span>Difficulty: {String(req.config.difficulty)}</span>
                      ) : null}
                      {req.prompt_context && (
                        <span className="truncate max-w-xs">Prompt: {req.prompt_context}</span>
                      )}
                      <span>Submitted: {formatDate(req.created_at)}</span>
                      {req.reviewed_at && <span>Reviewed: {formatDate(req.reviewed_at)}</span>}
                    </div>
                  </div>
                  <ActionButtons
                    req={req}
                    onDone={() => qc.invalidateQueries({ queryKey: ["admin-gen-requests"] })}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
