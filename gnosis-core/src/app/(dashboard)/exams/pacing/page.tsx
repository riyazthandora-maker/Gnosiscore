import type { Metadata } from "next"
import Link from "next/link"
import { Plus, BookOpen, Calendar, LayoutGrid } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Pacing Plans" }

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export default async function PacingPlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("pacing_plans")
    .select("id, title, academic_year, start_month, books(title), student_grades(name), pacing_milestones(id)")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false })

  const plans = (data ?? []).map(p => ({
    id: p.id as string,
    title: p.title as string,
    academic_year: p.academic_year as string,
    start_month: p.start_month as number,
    book_title: (p.books as unknown as { title: string } | null)?.title ?? "—",
    grade_name: (p.student_grades as unknown as { name: string } | null)?.name ?? "—",
    milestone_count: Array.isArray(p.pacing_milestones) ? p.pacing_milestones.length : 0,
  }))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pacing Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {plans.length === 0 ? "No plans yet." : `${plans.length} plan${plans.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/exams/pacing/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          New Plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <LayoutGrid className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Create your first pacing plan to map chapters across the year.</p>
          <Link
            href="/exams/pacing/new"
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-3.5" /> New Plan
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(p => (
            <Link
              key={p.id}
              href={`/exams/pacing/${p.id}`}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold leading-snug group-hover:text-primary transition-colors">{p.title}</p>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {p.milestone_count}/48
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="size-3.5 shrink-0" />
                  <span className="truncate">{p.book_title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>{p.academic_year} · Starts {MONTH_NAMES[p.start_month - 1]}</span>
                </div>
              </div>
              <div className="mt-auto">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${Math.min(100, Math.round((p.milestone_count / 48) * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {Math.round((p.milestone_count / 48) * 100)}% scheduled · {p.grade_name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
