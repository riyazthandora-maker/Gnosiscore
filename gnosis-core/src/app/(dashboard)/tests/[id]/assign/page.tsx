"use client"

import { useState } from "react"
import { use } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Users, CheckCircle2, AlertCircle, Loader2, Search, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Student {
  id: string
  email: string
  full_name: string | null
}

interface AssignResult {
  assigned: number
  not_found: string[]
}

export default function AssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newEmails, setNewEmails] = useState("")
  const [search, setSearch] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [result, setResult] = useState<AssignResult | null>(null)

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

      const res = await fetch(`/api/educator/tests/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailList, due_at: dueAt || undefined }),
      })
      if (!res.ok) { const { error: e } = await res.json(); throw new Error(e) }
      return res.json() as Promise<AssignResult>
    },
    onSuccess: (data) => setResult(data),
  })

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
            <Button variant="ghost" onClick={() => router.push(`/tests/${id}`)}>Back to test</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assign test</h1>
        <p className="text-muted-foreground">Choose existing students or enter new email addresses.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-5">

        {/* Existing students */}
        {studentsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : students.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold">Your students</label>
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
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
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
                      {s.full_name && (
                        <p className="truncate text-sm font-medium">{s.full_name}</p>
                      )}
                      <p className={cn(
                        "truncate",
                        s.full_name ? "text-xs text-muted-foreground" : "text-sm font-medium"
                      )}>
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

        {/* New email addresses */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
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

        {/* Due date */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Due date <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error instanceof Error ? error.message : "Something went wrong."}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => router.push(`/tests/${id}`)}>Cancel</Button>
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
    </div>
  )
}
