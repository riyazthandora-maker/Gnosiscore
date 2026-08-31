import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { AssignWizard } from "@/components/exams/assign-wizard"
import type { RosterEntry, StudentGrade } from "@/types"

export const metadata: Metadata = { title: "Assign Test" }

export default async function AssignPage({
  searchParams,
}: {
  searchParams: Promise<{ exam_id?: string }>
}) {
  const { exam_id } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [examsRes, studentsRes] = await Promise.all([
    supabase
      .from("exam_papers")
      .select("id, title, created_at, questions")
      .eq("teacher_id", user!.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("student_roster")
      .select("*, grade:student_grades(id, name, teacher_id, created_at)")
      .eq("teacher_id", user!.id)
      .neq("status", "archived")
      .order("name"),
  ])

  const exams = (examsRes.data ?? []).map(e => ({
    id: e.id as string,
    title: e.title as string,
    created_at: e.created_at as string,
    question_count: Array.isArray(e.questions) ? e.questions.length : 0,
  }))

  const students = (studentsRes.data ?? []) as RosterEntry[]

  // Derive unique grades from student data — no separate query needed
  const grades: StudentGrade[] = Array.from(
    new Map(
      students
        .filter(s => s.grade_id && s.grade)
        .map(s => [s.grade_id!, s.grade!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link
          href="/exams"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Exams
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-semibold">Assign Test</h1>
      </div>

      <AssignWizard
        exams={exams}
        grades={grades}
        students={students}
        preselectedExamId={exam_id}
      />
    </div>
  )
}
