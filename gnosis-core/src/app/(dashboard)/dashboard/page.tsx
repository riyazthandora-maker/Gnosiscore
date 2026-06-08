import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Plus, FileText, BarChart3, Users, BookOpen, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Dashboard — GnosisCore" }

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums", accent ? "text-primary" : "text-foreground")}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso))
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [testsRes, studentsRes, questionsRes, recentRes] = await Promise.all([
    supabase.from("tests").select("id, is_published").eq("creator_id", user!.id),
    supabase.from("educator_students").select("student_id", { count: "exact", head: true }).eq("educator_id", user!.id),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("owner_id", user!.id).eq("status", "approved"),
    // Recent test completions from educator's tests
    supabase
      .from("test_attempts")
      .select("id, score, max_score, completed_at, tests!inner(creator_id, title), users!student_id(full_name)")
      .eq("tests.creator_id", user!.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(6),
  ])

  const tests = testsRes.data ?? []
  const recentAttempts = recentRes.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your teaching overview at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students linked" value={studentsRes.count ?? 0} sub="registered students" />
        <StatCard
          label="Tests"
          value={tests.length}
          sub={`${tests.filter((t) => t.is_published).length} published`}
        />
        <StatCard label="Approved questions" value={questionsRes.count ?? 0} sub="in your bank" />
        <StatCard
          label="Test completions"
          value={recentAttempts.length > 0 ? recentAttempts.length + "+" : 0}
          sub="by your students"
          accent
        />
      </div>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/documents", icon: FileText, label: "Upload document", desc: "Add study material" },
            { href: "/tests/generate", icon: Plus, label: "Generate questions", desc: "AI from your documents" },
            { href: "/analytics", icon: BarChart3, label: "View analytics", desc: "Test and student results" },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent completions
          </h2>
          {recentAttempts.length > 0 && (
            <Link href="/analytics" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          )}
        </div>

        {recentAttempts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <Users className="size-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">No completions yet</p>
              <p className="text-xs text-muted-foreground">Assign tests to students to see results here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentAttempts.map((attempt, idx) => {
              const profile = attempt.users as unknown as { full_name: string }
              const test = attempt.tests as unknown as { title: string }
              const pct = attempt.max_score && attempt.max_score > 0
                ? Math.round(((attempt.score ?? 0) / (attempt.max_score as number)) * 100)
                : null
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{profile?.full_name ?? "Student"}</span>
                      <span className="text-muted-foreground"> · {test?.title ?? "Test"}</span>
                    </p>
                    {attempt.completed_at && (
                      <p className="text-xs text-muted-foreground">{formatDate(attempt.completed_at)}</p>
                    )}
                  </div>
                  {pct !== null && (
                    <span className={cn(
                      "shrink-0 text-sm font-bold tabular-nums",
                      pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 60 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
                    )}>
                      {pct}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Empty-state nudge when no tests yet */}
      {tests.length === 0 && (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
          <BookOpen className="mx-auto size-8 text-primary/50" />
          <p className="font-medium">No tests yet — get started</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload a document, generate questions, review them, then build your first test.
          </p>
          <div className="flex justify-center gap-3 pt-1">
            <Link href="/documents" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Upload document
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
