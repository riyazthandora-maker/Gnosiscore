"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { BarChart3, Users, Loader2, ChevronUp, ChevronDown, ExternalLink, Brain } from "lucide-react"
import { cn } from "@/lib/utils"

interface TestRow {
  id: string
  title: string
  is_published: boolean
  question_count: number
  created_at: string
  assigned: number
  completed: number
  avg_score: number | null
  pass_rate: number | null
}

interface StudentRow {
  id: string
  full_name: string
  email: string
  assigned: number
  completed: number
  avg_score: number | null
  last_attempt_at: string | null
}

type SortKey = string
type SortDir = "asc" | "desc"

function ScoreBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
      pct >= 80 ? "bg-green-500/10 text-green-700 dark:text-green-400"
        : pct >= 60 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-destructive/10 text-destructive"
    )}>
      {pct}%
    </span>
  )
}

function SortButton({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: string; current: SortKey; dir: SortDir; onSort: (k: string) => void
}) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {active ? (dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />) : null}
    </button>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso))
}

function useSort<T>(rows: T[], defaultKey: string) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  function toggleSort(key: string) {
    if (key === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey] as number | string | null
    const bv = (b as Record<string, unknown>)[sortKey] as number | string | null
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === "asc" ? cmp : -cmp
  })

  return { sorted, sortKey, sortDir, toggleSort }
}

function TestsTab() {
  const { data, isLoading } = useQuery<{ tests: TestRow[] }>({
    queryKey: ["educator-analytics-tests"],
    queryFn: () => fetch("/api/educator/analytics/tests").then((r) => r.json()),
  })

  const { sorted, sortKey, sortDir, toggleSort } = useSort(data?.tests ?? [], "created_at")

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}</div>

  if (!data?.tests.length) return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      No tests yet. <Link href="/tests/generate" className="text-primary hover:underline">Generate questions</Link> to get started.
    </div>
  )

  const cols: { label: string; key: string }[] = [
    { label: "Test", key: "title" },
    { label: "Assigned", key: "assigned" },
    { label: "Completed", key: "completed" },
    { label: "Avg Score", key: "avg_score" },
    { label: "Pass Rate", key: "pass_rate" },
  ]

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {cols.map(({ label, key }) => (
              <th key={key} className="px-4 py-3 text-left">
                <SortButton label={label} sortKey={key} current={sortKey} dir={sortDir} onSort={toggleSort} />
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((test) => (
            <tr key={test.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{test.title}</span>
                  {!test.is_published && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Draft</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{test.question_count} questions · {formatDate(test.created_at)}</p>
              </td>
              <td className="px-4 py-3 tabular-nums">{test.assigned}</td>
              <td className="px-4 py-3 tabular-nums">
                {test.completed}
                {test.assigned > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({Math.round((test.completed / test.assigned) * 100)}%)
                  </span>
                )}
              </td>
              <td className="px-4 py-3"><ScoreBadge pct={test.avg_score} /></td>
              <td className="px-4 py-3"><ScoreBadge pct={test.pass_rate} /></td>
              <td className="px-4 py-3">
                <Link
                  href={`/tests/${test.id}/analytics`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Details <ExternalLink className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StudentsTab() {
  const { data, isLoading } = useQuery<{ students: StudentRow[] }>({
    queryKey: ["educator-analytics-students"],
    queryFn: () => fetch("/api/educator/analytics/students").then((r) => r.json()),
  })

  const { sorted, sortKey, sortDir, toggleSort } = useSort(data?.students ?? [], "completed")

  if (isLoading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}</div>

  if (!data?.students.length) return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      No students linked yet. <Link href="/tests" className="text-primary hover:underline">Assign a test</Link> to add students.
    </div>
  )

  const cols: { label: string; key: string }[] = [
    { label: "Student", key: "full_name" },
    { label: "Assigned", key: "assigned" },
    { label: "Completed", key: "completed" },
    { label: "Avg Score", key: "avg_score" },
    { label: "Last activity", key: "last_attempt_at" },
  ]

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {cols.map(({ label, key }) => (
              <th key={key} className="px-4 py-3 text-left">
                <SortButton label={label} sortKey={key} current={sortKey} dir={sortDir} onSort={toggleSort} />
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium">{s.full_name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </td>
              <td className="px-4 py-3 tabular-nums">{s.assigned}</td>
              <td className="px-4 py-3 tabular-nums">
                {s.completed}
                {s.assigned > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({Math.round((s.completed / s.assigned) * 100)}%)
                  </span>
                )}
              </td>
              <td className="px-4 py-3"><ScoreBadge pct={s.avg_score} /></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(s.last_attempt_at)}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/analytics/students/${s.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Brain className="size-3" /> Insights
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Tab = "tests" | "students"

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("tests")

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "tests", label: "Tests", icon: BarChart3 },
    { key: "students", label: "Students", icon: Users },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Test performance and student progress across your class.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "tests" ? <TestsTab /> : <StudentsTab />}
    </div>
  )
}
