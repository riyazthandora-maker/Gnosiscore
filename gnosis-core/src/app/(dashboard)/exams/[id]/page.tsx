import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import type { ExamQuestion } from "@/types"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Exam Detail" }

const OPTION_KEYS = ["A", "B", "C", "D"] as const

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <span className={cn(
      "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
      difficulty === "easy"
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
    )}>
      {difficulty}
    </span>
  )
}

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("exam_papers")
    .select("id, title, created_at, questions")
    .eq("id", id)
    .eq("teacher_id", user!.id)
    .single()

  if (error || !data) notFound()

  const questions = (data.questions ?? []) as ExamQuestion[]
  const createdAt = new Date(data.created_at as string).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  })

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/exams"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="size-3.5" /> Exams
          </Link>
          <h1 className="text-xl font-semibold">{data.title as string}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {questions.length} question{questions.length !== 1 ? "s" : ""} · Created {createdAt}
          </p>
        </div>
        <Link
          href={`/exams/assign?exam_id=${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors shrink-0 self-start"
        >
          <Send className="size-4" />
          Assign
        </Link>
      </div>

      {/* Questions */}
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions found.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-relaxed flex-1">
                  <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                  {q.body}
                </p>
                <DifficultyBadge difficulty={q.difficulty} />
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OPTION_KEYS.map(key => {
                  const isCorrect = q.correct === key
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
                        isCorrect
                          ? "border-green-400/60 bg-green-50 dark:bg-green-900/20"
                          : "border-border bg-muted/30"
                      )}
                    >
                      <span className={cn(
                        "shrink-0 font-semibold text-xs mt-0.5",
                        isCorrect ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
                      )}>
                        {key}
                      </span>
                      <span className={cn(isCorrect && "text-green-900 dark:text-green-100 font-medium")}>
                        {q.options[key]}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Explanation: </span>
                  {q.explanation}
                </div>
              )}

              {/* Topic */}
              {q.topic && (
                <p className="text-[11px] text-muted-foreground/70">Topic: {q.topic}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
