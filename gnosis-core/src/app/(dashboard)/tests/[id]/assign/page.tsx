"use client"

import { useState } from "react"
import { use } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  Users, CheckCircle2, AlertCircle, Loader2, Search, UserPlus,
  Clock, Eye, EyeOff, RefreshCw, Ban, Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Test } from "@/types"

interface Student {
  id: string
  email: string
  full_name: string | null
}

interface AssignResult {
  assigned: number
  not_found: string[]
}

function Toggle({
  id, label, description, checked, onChange, disabled,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", disabled && "opacity-50")}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )} />
      </button>
    </div>
  )
}

export default function AssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testId } = use(params)
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newEmails, setNewEmails] = useState("")
  const [search, setSearch] = useState("")
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(20)
  const [showTimer, setShowTimer] = useState(true)
  const [showAnswerKey, setShowAnswerKey] = useState(true)
  const [allowRetake, setAllowRetake] = useState(true)
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [result, setResult] = useState<AssignResult | null>(null)

  const { data: testData } = useQuery<{ test: Test }>({
    queryKey: ["test-detail", testId],
    queryFn: () => fetch(`/api/educator/tests/${testId}`).then((r) => r.json()),
  })

  const { data: studentsData, isLoading: studentsLoading } = useQuery<{ students: Student[] }>({
    queryKey: ["educator-students"],
    queryFn: () => fetch("/api/educator/students").then((r) => r.json()),
  })

  const students = studentsData?.students ?? []
  const filtered = search.trim()
    ? students.filter((s) =>
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.full_name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : students

  function toggleStudent(email: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const typedEmailList = newEmails.split(/[\n,;]/).map((e) => e.trim().toLowerCase()).filter(Boolean)
  const totalCount = new Set([...Array.from(selected), ...typedEmailList]).size

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const emailList = [...new Set([...Array.from(selected), ...typedEmailList])]
      if (emailList.length === 0) throw new Error("Select or enter at least one student.")

      const res = await fetch("/api/educator/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_id: testId,
          emails: emailList,
          time_limit_minutes: timeLimitMinutes,
          show_timer: timeLimitMinutes > 0 ? showTimer : false,
          show_answer_key: showAnswerKey,
          allow_retake: allowRetake,
          starts_at: startsAt || undefined,
          ends_at: endsAt || undefined,
        }),
      })
      if (!res.ok) { const { error: e } = await res.json(); throw new Error(e) }
      return res.json() as Promise<AssignResult>
    },
    onSuccess: (data) => setResult(data),
  })

  const testTitle = testData?.test?.title ?? "Test"
  const questionCount = testData?.test?.question_ids?.length ?? 0

  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-10">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-green-500/10">
              <CheckCircle2 className="size-7 text-green-500" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold">Test assigned</h2>
            <p className="text-sm text-muted-foreground">
              Assigned to {result.assigned} student{result.assigned !== 1 ? "s" : ""}.
            </p>
          </div>

          {result.not_found.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-left text-xs text-amber-700 dark:text-amber-400">
              <p className="font-medium mb-1">These emails weren&apos;t found:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.not_found.map((e) => <li key={e}>{e}</li>)}
              </ul>
              <p className="mt-2">Students need to register first before they can be assigned tests.</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => { setResult(null); setSelected(new Set()); setNewEmails("") }}>
              Assign more students
            </Button>
            <Button variant="ghost" onClick={() => router.push("/assignments")}>View assignments</Button>
            <Button variant="ghost" onClick={() => router.push(`/tests/${testId}`)}>Back to test</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assign test</h1>
        <p className="text-muted-foreground">
          {testTitle}
          {questionCount > 0 && <span className="ml-2 text-sm">· {questionCount} questions</span>}
        </p>
      </div>

      {/* Student selection */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <p className="text-sm font-semibold">Students</p>

        {studentsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : students.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Your students</label>
            {students.length > 4 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            )}
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
              {filtered.map((s) => {
                const checked = selected.has(s.email)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStudent(s.email)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    )}>
                      {checked && <CheckCircle2 className="size-3" />}
                    </div>
                    <div className="min-w-0">
                      {s.full_name && <p className="truncate text-sm font-medium">{s.full_name}</p>}
                      <p className={cn("truncate", s.full_name ? "text-xs text-muted-foreground" : "text-sm font-medium")}>
                        {s.email}
                      </p>
                    </div>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">No students match your search.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <UserPlus className="size-4" />
            {students.length > 0 ? "Add new students" : "Student emails"}
          </label>
          <textarea
            value={newEmails}
            onChange={(e) => setNewEmails(e.target.value)}
            placeholder={"student@example.com\nanother@example.com"}
            rows={3}
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <p className="text-xs text-muted-foreground">One per line, or comma/semicolon separated.</p>
        </div>
      </div>

      {/* Time & Policies */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <p className="text-sm font-semibold">Time & Policies</p>

        {/* Time limit */}
        <div className="space-y-2">
          <label htmlFor="time-limit" className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4" />
            Time limit <span className="font-normal text-muted-foreground">(minutes)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id="time-limit"
              type="number"
              min={0}
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-28 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 tabular-nums"
            />
            <span className="text-xs text-muted-foreground">
              {timeLimitMinutes === 0 ? "No time limit" : `${timeLimitMinutes} min`}
            </span>
          </div>
        </div>

        {/* Show timer */}
        <Toggle
          id="show-timer"
          label="Show countdown timer"
          description="Students see the timer while taking the test."
          checked={showTimer}
          onChange={setShowTimer}
          disabled={timeLimitMinutes === 0}
        />

        {/* Answer key */}
        <Toggle
          id="show-answer-key"
          label="Show answer key after submission"
          description="Students can review correct answers and explanations after completing."
          checked={showAnswerKey}
          onChange={setShowAnswerKey}
        />

        {/* Retake policy */}
        <Toggle
          id="allow-retake"
          label="Allow retakes"
          description="Students can attempt this test more than once."
          checked={allowRetake}
          onChange={setAllowRetake}
        />
      </div>

      {/* Scheduling */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Scheduling window <span className="font-normal text-muted-foreground">(optional)</span></p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start date & time</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground">When the test becomes visible to students.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End date & time</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground">When the test is removed from the student portal.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error instanceof Error ? error.message : "Something went wrong."}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/tests/${testId}`)}>Cancel</Button>
        <Button
          disabled={isPending || totalCount === 0}
          onClick={() => mutate()}
          className="gap-2"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
          Assign{totalCount > 0 ? ` (${totalCount})` : ""}
        </Button>
      </div>
    </div>
  )
}
