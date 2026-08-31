import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Clock, CheckCircle2, BookOpen, AlertTriangle, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "My Tests — GnosisCore" }

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-destructive"
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Score</span>
        <span className={cn("font-bold", pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function dueSoon(endsAt: string | null) {
  if (!endsAt) return false
  const msLeft = new Date(endsAt).getTime() - Date.now()
  return msLeft > 0 && msLeft < 48 * 60 * 60 * 1000
}

export default async function StudentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── New exam_assignments (Assign Test module) ──────────────────────────────
  const { data: rosterEntries } = await supabase
    .from("student_roster")
    .select("id")
    .eq("student_user_id", user!.id)

  const rosterIds = (rosterEntries ?? []).map(r => r.id as string)

  const { data: examAssignments } = rosterIds.length
    ? await supabase
        .from("exam_assignments")
        .select("*, exam_papers(id, title, questions), exam_sessions(id, status, score, max_score, completed_at, attempt_number)")
        .in("student_roster_id", rosterIds)
        .order("assigned_at", { ascending: false })
    : { data: [] }

  const nowTs = Date.now()

  const pendingExam = (examAssignments ?? []).filter(a => {
    if (a.starts_at && new Date(a.starts_at as string).getTime() > nowTs) return false
    if (a.ends_at && new Date(a.ends_at as string).getTime() < nowTs) return false
    const sessions = (a.exam_sessions as Array<{ status: string }> | null) ?? []
    const completedCount = sessions.filter(s => s.status === "submitted" || s.status === "auto_submitted").length
    return completedCount < (a.max_attempts as number)
  })

  const completedExam = (examAssignments ?? []).filter(a => {
    const sessions = (a.exam_sessions as Array<{ status: string }> | null) ?? []
    return sessions.some(s => s.status === "submitted" || s.status === "auto_submitted")
  })
  // ─────────────────────────────────────────────────────────────────────────

  const { data: assignments } = await supabase
    .from("test_assignments")
    .select("*, tests(title, description, is_published, question_ids)")
    .eq("student_id", user!.id)
    .order("assigned_at", { ascending: false })

  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("test_id, score, max_score, completed_at")
    .eq("student_id", user!.id)
    .not("completed_at", "is", null)

  const attemptMap = new Map(attempts?.map((a) => [a.test_id, a]) ?? [])
  const now = new Date()

  const pending = (assignments ?? []).filter((a) => {
    const test = a.tests as { is_published: boolean } | null
    if (!test?.is_published) return false
    // Filter by scheduling window
    if (a.starts_at && new Date(a.starts_at) > now) return false
    if (a.ends_at && new Date(a.ends_at) < now) return false
    const hasAttempt = attemptMap.has(a.test_id)
    if (!hasAttempt) return true
    // Allow re-entry if retakes are allowed
    return a.allow_retake === true
  })

  const completed = (assignments ?? []).filter((a) => attemptMap.has(a.test_id))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Tests</h1>
        <p className="text-muted-foreground">Tests assigned to you by your educator.</p>
      </div>

      {/* New exam assignments */}
      {pendingExam.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3.5" />
            Assigned Tests ({pendingExam.length})
          </h2>
          {pendingExam.map(a => {
            const paper = a.exam_papers as { id: string; title: string; questions: unknown[] } | null
            const urgent = dueSoon(a.ends_at as string | null)
            const sessions = (a.exam_sessions as Array<{ status: string; attempt_number: number }> | null) ?? []
            const completedCount = sessions.filter(s => s.status === "submitted" || s.status === "auto_submitted").length
            const isRetake = completedCount > 0
            const qCount = Array.isArray(paper?.questions) ? paper.questions.length : 0
            return (
              <Link
                key={a.id}
                href={`/student/exam/${a.id}`}
                className={cn(
                  "block rounded-xl border bg-card p-5 transition-colors hover:border-primary/40",
                  urgent ? "border-amber-500/40" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{paper?.title ?? "Untitled"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{qCount} questions</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />{a.duration_minutes as number} min
                      </span>
                      {a.ends_at && (
                        <span className={cn("flex items-center gap-1", urgent ? "text-amber-600 dark:text-amber-400 font-medium" : "")}>
                          {urgent && <AlertTriangle className="size-3" />}
                          <Calendar className="size-3" />
                          Due {new Date(a.ends_at as string).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      <span>Attempt {completedCount + 1} / {a.max_attempts as number}</span>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                    {isRetake ? "Retake →" : "Start →"}
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      )}

      {completedExam.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Completed Tests ({completedExam.length})
          </h2>
          {completedExam.map(a => {
            const paper = a.exam_papers as { title: string } | null
            const sessions = (a.exam_sessions as Array<{ status: string; score: number; max_score: number; completed_at: string }> | null) ?? []
            const last = sessions.filter(s => s.status === "submitted" || s.status === "auto_submitted").at(-1)
            const pct = last && last.max_score > 0 ? Math.round((last.score / last.max_score) * 100) : 0
            return (
              <div
                key={a.id}
                className="block rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{paper?.title ?? "Untitled"}</p>
                    {last?.completed_at && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Completed {new Date(last.completed_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                    {last && <ScoreBar pct={pct} />}
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* Pending tests (legacy) */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="size-3.5" />
          To do ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <BookOpen className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No pending tests — check back later.</p>
          </div>
        ) : (
          pending.map((a) => {
            const test = a.tests as { title: string; description: string | null; question_ids: string[] }
            const urgent = dueSoon(a.ends_at)
            const isRetake = attemptMap.has(a.test_id)
            return (
              <Link
                key={a.id}
                href={`/student/test/${a.test_id}`}
                className={cn(
                  "block rounded-xl border bg-card p-5 transition-colors hover:border-primary/40",
                  urgent ? "border-amber-500/40" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{test.title}</p>
                    {test.description && (
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{test.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{test.question_ids.length} questions</span>
                      {a.time_limit_minutes > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />{a.time_limit_minutes} min
                        </span>
                      )}
                      {a.ends_at && (
                        <span className={cn(
                          "flex items-center gap-1",
                          urgent ? "text-amber-600 dark:text-amber-400 font-medium" : ""
                        )}>
                          {urgent && <AlertTriangle className="size-3" />}
                          <Calendar className="size-3" />
                          Due {new Date(a.ends_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                    {isRetake ? "Retake →" : "Start →"}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </section>

      {/* Completed tests */}
      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Completed ({completed.length})
          </h2>
          {completed.map((a) => {
            const attempt = attemptMap.get(a.test_id)
            const test = a.tests as { title: string; question_ids: string[] }
            const score = attempt?.score ?? 0
            const maxScore = attempt?.max_score ?? 1
            const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
            return (
              <Link
                key={a.id}
                href={`/student/test/${a.test_id}/results`}
                className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{test.title}</p>
                    {attempt?.completed_at && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Completed {new Date(attempt.completed_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                    <ScoreBar pct={pct} />
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">Review →</div>
                </div>
              </Link>
            )
          })}
        </section>
      )}
    </div>
  )
}
