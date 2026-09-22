import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Calendar, Clock, CheckCircle2, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "My Schedule — GnosisCore" }

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function getWeekStatus(month: number, week: number, year: string): "past" | "current" | "upcoming" {
  const now = new Date()
  const [y1, y2] = year.split("-").map(Number)
  const currentStartMonth = now.getMonth() + 1
  const slotYear = month >= currentStartMonth ? y1 : y2
  const slotDate = new Date(slotYear, month - 1, 1 + (week - 1) * 7)
  const slotEnd  = new Date(slotYear, month - 1, 1 + (week - 1) * 7 + 6, 23, 59, 59)
  if (now > slotEnd) return "past"
  if (now >= slotDate && now <= slotEnd) return "current"
  return "upcoming"
}

export default async function StudentPacingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: roster } = await supabase
    .from("student_roster")
    .select("grade_id")
    .eq("student_user_id", user!.id)
    .not("grade_id", "is", null)
    .limit(1)
    .single()

  if (!roster?.grade_id) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
          <p className="text-muted-foreground">Your class curriculum pacing plan.</p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <Calendar className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">You haven&apos;t been assigned to a class yet.</p>
        </div>
      </div>
    )
  }

  const { data } = await supabase
    .from("pacing_plans")
    .select(`
      id, title, academic_year, start_month,
      books ( id, title ),
      pacing_milestones ( id, node_id, node_level, node_title, month, week_in_month, topic_notes )
    `)
    .eq("grade_id", roster.grade_id)
    .order("created_at", { ascending: false })

  const plans = data ?? []

  if (plans.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
          <p className="text-muted-foreground">Your class curriculum pacing plan.</p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <Calendar className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No pacing plan has been set for your class yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
        <p className="text-muted-foreground">Your class curriculum pacing plan.</p>
      </div>

      {plans.map(plan => {
        const book = plan.books as unknown as { title: string } | null
        const milestones = (plan.pacing_milestones ?? []) as {
          id: string; node_id: string; node_level: string; node_title: string
          month: number; week_in_month: number; topic_notes: string | null
        }[]

        // Group milestones by month/week slot, show chapters only at top level
        const chapterMilestones = milestones.filter(m => m.node_level === "chapter")

        // Get unique slots and sort by academic year order
        const startMonth = plan.start_month as number
        const orderedMonths = Array.from({ length: 12 }, (_, i) => ((startMonth - 1 + i) % 12) + 1)

        // Group chapters by month
        const byMonth = new Map<number, typeof chapterMilestones>()
        chapterMilestones.forEach(m => {
          if (!byMonth.has(m.month)) byMonth.set(m.month, [])
          byMonth.get(m.month)!.push(m)
        })

        return (
          <div key={plan.id as string} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{plan.title as string}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BookOpen className="size-3.5" />
                <span>{book?.title ?? "—"}</span>
                <span>·</span>
                <span>{plan.academic_year as string}</span>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</span>
              </div>
              <div className="divide-y divide-border/50">
                {orderedMonths.map(month => {
                  const monthChapters = byMonth.get(month)
                  if (!monthChapters?.length) return null

                  return monthChapters.map(m => {
                    const status = getWeekStatus(m.month, m.week_in_month, plan.academic_year as string)
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3",
                          status === "current" && "bg-primary/5",
                          status === "past" && "opacity-60",
                        )}
                      >
                        <div className="shrink-0 text-center w-20">
                          <p className={cn("text-xs font-semibold", status === "current" ? "text-primary" : "text-muted-foreground")}>
                            W{m.week_in_month} · {MONTH_SHORT[m.month - 1]}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", status === "past" && "line-through")}>{m.node_title}</p>
                          {m.topic_notes && <p className="text-xs text-muted-foreground">{m.topic_notes}</p>}
                        </div>
                        <div className="shrink-0">
                          {status === "past" && <CheckCircle2 className="size-4 text-green-500" />}
                          {status === "current" && <Clock className="size-4 text-primary" />}
                          {status === "upcoming" && <Calendar className="size-4 text-muted-foreground/40" />}
                        </div>
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
