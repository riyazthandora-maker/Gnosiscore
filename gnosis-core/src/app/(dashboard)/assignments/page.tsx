"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ClipboardList, Loader2, Clock, Eye, EyeOff, RefreshCw, Ban,
  Trash2, AlertCircle, BookOpen, Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Assignment {
  test_id: string
  test_title: string
  question_count: number
  student_count: number
  time_limit_minutes: number
  show_timer: boolean
  show_answer_key: boolean
  allow_retake: boolean
  starts_at: string | null
  ends_at: string | null
  assigned_at: string
  status: "upcoming" | "active" | "expired"
}

function StatusBadge({ status }: { status: Assignment["status"] }) {
  const styles = {
    upcoming: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    active: "bg-green-500/10 text-green-600 dark:text-green-400",
    expired: "bg-muted text-muted-foreground",
  }
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize", styles[status])}>
      {status}
    </span>
  )
}

function formatDt(iso: string | null) {
  if (!iso) return null
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso))
}

function PolicyPills({ a }: { a: Assignment }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {a.time_limit_minutes > 0 ? (
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          <Clock className="size-3" /> {a.time_limit_minutes} min
          {a.time_limit_minutes > 0 && (a.show_timer
            ? <Eye className="size-3 ml-0.5" />
            : <EyeOff className="size-3 ml-0.5" />)}
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          <Clock className="size-3" /> No limit
        </span>
      )}
      {a.show_answer_key ? (
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          <Eye className="size-3" /> Answer key visible
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          <EyeOff className="size-3" /> Answer key hidden
        </span>
      )}
      {a.allow_retake ? (
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          <RefreshCw className="size-3" /> Retakes on
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          <Ban className="size-3" /> Single attempt
        </span>
      )}
    </div>
  )
}

export default function AssignmentsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ assignments: Assignment[] }>({
    queryKey: ["educator-assignments"],
    queryFn: () => fetch("/api/educator/assignments").then((r) => r.json()),
  })

  const { mutate: cancel, isPending: cancelling, variables: cancellingId } = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/educator/assignments/${testId}`, { method: "DELETE" })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["educator-assignments"] }),
  })

  const assignments = data?.assignments ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">All tests you&apos;ve assigned to students.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 py-20 justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading assignments…</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="size-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to a test and click <strong>Assign</strong> to get started.
            </p>
          </div>
          <Link href="/tests">
            <Button variant="outline" className="gap-2">
              <BookOpen className="size-4" /> View tests
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div
              key={a.test_id}
              className="rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/tests/${a.test_id}`}
                      className="font-semibold hover:text-primary transition-colors truncate"
                    >
                      {a.test_title}
                    </Link>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.question_count} questions
                    {" · "}
                    {a.student_count} student{a.student_count !== 1 ? "s" : ""}
                    {" · "}
                    Assigned {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(a.assigned_at))}
                  </p>

                  <PolicyPills a={a} />

                  {(a.starts_at || a.ends_at) && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Calendar className="size-3 shrink-0" />
                      {a.starts_at && <span>From {formatDt(a.starts_at)}</span>}
                      {a.starts_at && a.ends_at && <span>→</span>}
                      {a.ends_at && <span>Until {formatDt(a.ends_at)}</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/tests/${a.test_id}/assign`}>
                    <Button variant="outline" size="sm" className="text-xs">Re-assign</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={cancelling && cancellingId === a.test_id}
                    onClick={() => cancel(a.test_id)}
                  >
                    {cancelling && cancellingId === a.test_id
                      ? <Loader2 className="size-4 animate-spin" />
                      : <Trash2 className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
