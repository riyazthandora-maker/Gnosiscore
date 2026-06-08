"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts"
import { ArrowLeft, Download, Loader2, Users, CheckCircle2, BarChart3, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DistributionBucket { range: string; count: number }
interface QuestionStat {
  id: string; question_text: string; difficulty: string | null
  topic_tags: string[]; attempts: number; correct: number; accuracy_pct: number | null
}
interface StudentResult {
  student_id: string; full_name: string; email: string
  score: number | null; max_score: number | null; pct: number | null; completed_at: string | null
}
interface TestAnalytics {
  test: { id: string; title: string; question_ids: string[]; time_limit_min: number | null; is_published: boolean }
  stats: { assigned: number; completed: number; avg_score: number | null; pass_rate: number | null; score_distribution: DistributionBucket[] }
  questions: QuestionStat[]
  students: StudentResult[]
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function ScoreBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
      pct >= 80 ? "bg-green-500/10 text-green-700 dark:text-green-400"
        : pct >= 60 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-destructive/10 text-destructive"
    )}>
      {pct}%
    </span>
  )
}

function AccuracyBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">No attempts</span>
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-destructive"
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  )
}

const CHART_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#22c55e", "#16a34a"]

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

export default function TestAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const { data, isLoading, error } = useQuery<TestAnalytics>({
    queryKey: ["test-analytics", id],
    queryFn: () => fetch(`/api/educator/tests/${id}/analytics`).then((r) => r.json()),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      </div>
    )
  }

  if (error || !data?.test) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load analytics.</p>
        <Link href="/analytics" className="text-sm text-primary hover:underline">Back to Analytics</Link>
      </div>
    )
  }

  const { test, stats, questions, students } = data
  const sortedQuestions = [...questions].sort((a, b) => (a.accuracy_pct ?? 100) - (b.accuracy_pct ?? 100))
  const hasAttempts = stats.completed > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/analytics" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft className="size-3.5" /> Analytics
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {(test.question_ids as string[]).length} questions
            {test.time_limit_min && ` · ${test.time_limit_min} min time limit`}
          </p>
        </div>
        {hasAttempts && (
          <a href={`/api/educator/tests/${id}/export`} download>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="size-3.5" /> Export CSV
            </Button>
          </a>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Assigned" value={stats.assigned} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed}
          sub={stats.assigned > 0 ? `${Math.round((stats.completed / stats.assigned) * 100)}% completion` : undefined} />
        <StatCard icon={BarChart3} label="Avg score" value={stats.avg_score !== null ? `${stats.avg_score}%` : "—"} />
        <StatCard icon={CheckCircle2} label="Pass rate" value={stats.pass_rate !== null ? `${stats.pass_rate}%` : "—"}
          sub="≥ 60% threshold" />
      </div>

      {!hasAttempts ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <BarChart3 className="size-10 text-muted-foreground/40" />
          <p className="font-medium">No attempts yet</p>
          <p className="text-sm text-muted-foreground">Assign this test to students to start seeing results.</p>
          <Link href={`/tests/${id}/assign`}>
            <Button variant="outline" size="sm">Assign test</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Score distribution */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Score distribution</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.score_distribution} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted))" }}
                    formatter={(v) => { const n = Number(v ?? 0); return [`${n} student${n !== 1 ? "s" : ""}`, "Count"] }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.score_distribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Question difficulty */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Question difficulty <span className="font-normal normal-case">(hardest first)</span>
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Question</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Difficulty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Accuracy</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedQuestions.map((q, idx) => (
                    <tr key={q.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3 max-w-sm">
                        <p className="line-clamp-2 text-sm">{q.question_text}</p>
                        {q.topic_tags.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">{q.topic_tags[0]}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-xs text-muted-foreground">{q.difficulty ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3"><AccuracyBar pct={q.accuracy_pct} /></td>
                      <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                        {q.correct}/{q.attempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Student results */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Student results</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Student", "Score", "Percentage", "Completed"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.student_id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm">
                        {s.score ?? 0} / {s.max_score ?? 0}
                      </td>
                      <td className="px-4 py-3"><ScoreBadge pct={s.pct} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(s.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
