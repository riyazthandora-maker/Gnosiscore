"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, Clock, Link2, Unlink, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdminStudentRow, AccountStatus } from "@/types"

type FilterTab = "all" | "hold" | "linked"

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "hold", label: "On hold" },
  { key: "linked", label: "Linked" },
]

function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, { label: string; cls: string; icon: typeof Clock }> = {
    hold:     { label: "On hold", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Clock },
    pending:  { label: "Pending", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Clock },
    approved: { label: "Active",  cls: "bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle2 },
    rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive", icon: Clock },
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

export default function AdminStudentsPage() {
  const [tab, setTab] = useState<FilterTab>("all")

  const { data, isLoading, isError, refetch } = useQuery<{ students: AdminStudentRow[] }>({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const r = await fetch("/api/admin/students")
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    },
    retry: 2,
    refetchInterval: 30_000,
  })

  const all = data?.students ?? []
  const students =
    tab === "hold" ? all.filter((s) => !s.linked)
    : tab === "linked" ? all.filter((s) => s.linked)
    : all

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">
          Everyone who registered as a student, what they need help with, and whether a teacher has claimed them.
        </p>
      </div>

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

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <p className="text-sm text-destructive font-medium">Failed to load students.</p>
          <button onClick={() => refetch()} className="text-xs text-muted-foreground underline">Retry</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : !students.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <GraduationCap className="size-10 text-muted-foreground/40" />
          <p className="font-medium">No students{tab === "all" ? "" : tab === "hold" ? " on hold" : " linked"}</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {students.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{s.full_name?.trim() || "—"}</p>
                      <StatusBadge status={s.account_status} />
                      {s.linked ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Link2 className="size-3" /> Linked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Unlink className="size-3" /> No teacher
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{s.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Grade: {s.grade?.trim() || "—"}</span>
                      <span>Subjects: {s.subjects?.trim() || "—"}</span>
                      <span>Contact: {s.whatsapp?.trim() || "—"}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Registered: {formatDate(s.created_at)}</span>
                      {s.linked && s.educator_names.length > 0 && (
                        <span>Teacher: {s.educator_names.join(", ")}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
