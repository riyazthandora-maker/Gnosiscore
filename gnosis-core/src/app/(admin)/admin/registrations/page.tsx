"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Clock, UserCheck, Loader2, Pencil, X, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AccountStatus = "pending" | "approved" | "rejected"
type FilterTab = "pending" | "approved" | "rejected" | "all"

interface EducatorRow {
  id: string
  email: string
  full_name: string
  whatsapp: string
  account_status: AccountStatus
  created_at: string
  approved_at: string | null
  token_cap: number | null
  tokens_used: number
  is_active: boolean
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const map = {
    pending:  { label: "Pending",  cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Clock },
    approved: { label: "Approved", cls: "bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle2 },
    rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive", icon: XCircle },
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

function TokenCapEditor({ userId, tokenCap, tokensUsed }: {
  userId: string
  tokenCap: number | null
  tokensUsed: number
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(tokenCap?.toString() ?? "")

  const { mutate, isPending } = useMutation({
    mutationFn: async (cap: number | null) => {
      const res = await fetch(`/api/admin/users/${userId}/token-cap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_cap: cap }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-registrations"] })
      setEditing(false)
    },
  })

  const handleSave = () => {
    const trimmed = inputVal.trim()
    if (trimmed === "") {
      mutate(null)
    } else {
      const n = parseInt(trimmed, 10)
      if (!isNaN(n) && n >= 0) mutate(n)
    }
  }

  const pct = tokenCap ? Math.min((tokensUsed / tokenCap) * 100, 100) : 0
  const barColor = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-violet-500"

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      {!editing ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Tokens used</span>
              <span className="text-xs font-medium tabular-nums">
                {tokensUsed.toLocaleString()}
                {tokenCap !== null ? ` / ${tokenCap.toLocaleString()}` : " (no cap)"}
              </span>
            </div>
            {tokenCap !== null && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
          <button
            onClick={() => { setInputVal(tokenCap?.toString() ?? ""); setEditing(true) }}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Set token cap"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="number"
              min={0}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Leave blank for no cap"
              className="w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
              autoFocus
            />
          </div>
          <Button size="sm" className="h-7 px-2.5 text-xs" disabled={isPending} onClick={handleSave}>
            {isPending ? <Loader2 className="size-3 animate-spin" /> : "Save"}
          </Button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function ApproveRejectButtons({ userId, currentStatus, onDone }: {
  userId: string
  currentStatus: AccountStatus
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [rejectNote, setRejectNote] = useState("")
  const [showReject, setShowReject] = useState(false)

  const { mutate, isPending, variables } = useMutation({
    mutationFn: async ({ action, note }: { action: "approve" | "reject"; note?: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-registrations"] })
      onDone()
    },
  })

  if (currentStatus !== "pending") return null

  if (showReject) {
    return (
      <div className="flex flex-col gap-2 items-end">
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Reason for rejection (required)"
          rows={2}
          className="w-64 rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
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

function ActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const qc = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: async (active: boolean) => {
      const res = await fetch(`/api/admin/users/${userId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-registrations"] }),
  })

  return (
    <button
      onClick={() => mutate(!isActive)}
      disabled={isPending}
      title={isActive ? "Deactivate teacher" : "Activate teacher"}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors border",
        isActive
          ? "border-green-500/30 bg-green-500/10 text-green-600 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 dark:text-green-400"
          : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30"
      )}
    >
      {isPending ? <Loader2 className="size-3 animate-spin" /> : <Power className="size-3" />}
      {isActive ? "Active" : "Inactive"}
    </button>
  )
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: "pending",  label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all",      label: "All" },
]

export default function RegistrationsPage() {
  const [tab, setTab] = useState<FilterTab>("pending")
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery<{ users: EducatorRow[] }>({
    queryKey: ["admin-registrations", tab],
    queryFn: async () => {
      const r = await fetch(`/api/admin/users?status=${tab}`)
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    },
    retry: 2,
    refetchInterval: 30_000,
  })

  const users = data?.users ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Educator Registrations</h1>
        <p className="text-muted-foreground">Review and approve or reject educator/parent accounts.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <p className="text-sm text-destructive font-medium">Failed to load registrations.</p>
          <button onClick={() => refetch()} className="text-xs text-muted-foreground underline">Retry</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : !users.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <UserCheck className="size-10 text-muted-foreground/40" />
          <p className="font-medium">No {tab === "all" ? "" : tab} registrations</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {users.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{u.full_name}</p>
                      <StatusBadge status={u.account_status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>WhatsApp: {u.whatsapp}</span>
                      <span>Registered: {formatDate(u.created_at)}</span>
                      {u.approved_at && <span>Reviewed: {formatDate(u.approved_at)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {u.account_status === "approved" && (
                      <ActiveToggle userId={u.id} isActive={u.is_active} />
                    )}
                    <ApproveRejectButtons
                      userId={u.id}
                      currentStatus={u.account_status}
                      onDone={() => qc.invalidateQueries({ queryKey: ["admin-registrations"] })}
                    />
                  </div>
                </div>
                <TokenCapEditor userId={u.id} tokenCap={u.token_cap} tokensUsed={u.tokens_used ?? 0} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
