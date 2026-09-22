import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { CreatePlanForm } from "@/components/pacing/create-plan-form"

export const metadata: Metadata = { title: "New Pacing Plan" }

export default async function NewPacingPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: booksData }, { data: gradesData }] = await Promise.all([
    supabase
      .from("books")
      .select("id, title")
      .order("title"),
    supabase
      .from("student_grades")
      .select("id, name")
      .eq("teacher_id", user!.id)
      .order("name"),
  ])

  const books  = (booksData  ?? []).map(b => ({ id: b.id  as string, title: b.title as string }))
  const grades = (gradesData ?? []).map(g => ({ id: g.id  as string, name:  g.name  as string }))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-2xl mx-auto w-full">
      <div>
        <Link
          href="/exams/pacing"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="size-3.5" /> Pacing Plans
        </Link>
        <h1 className="text-xl font-semibold">New Pacing Plan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Map chapters to weekly slots across the full academic year.
        </p>
      </div>

      <CreatePlanForm books={books} grades={grades} />
    </div>
  )
}
