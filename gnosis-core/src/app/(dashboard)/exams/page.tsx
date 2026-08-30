import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { ExamList } from "@/components/exams/exam-list"

export const metadata: Metadata = { title: "Exams" }

export default async function ExamsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("exam_papers")
    .select("id, title, created_at, questions")
    .eq("teacher_id", user!.id)
    .order("created_at", { ascending: false })

  const exams = (data ?? []).map(e => ({
    id: e.id as string,
    title: e.title as string,
    created_at: e.created_at as string,
    question_count: Array.isArray(e.questions) ? (e.questions as unknown[]).length : 0,
  }))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Exams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {exams.length === 0 ? "No exams yet." : `${exams.length} saved exam${exams.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/exams/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          New Exam
        </Link>
      </div>

      <ExamList exams={exams} />
    </div>
  )
}
