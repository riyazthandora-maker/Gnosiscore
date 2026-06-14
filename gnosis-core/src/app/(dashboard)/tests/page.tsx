"use client"

import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { BookOpen, Plus, Clock, CheckCircle2, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Test, Question } from "@/types"

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso))
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
      published
        ? "bg-green-500/10 text-green-600 dark:text-green-400"
        : "bg-muted text-muted-foreground"
    )}>
      {published ? <><CheckCircle2 className="size-3" /> Published</> : "Draft"}
    </span>
  )
}

export default function TestsPage() {
  const { data: testsData, isLoading: testsLoading } = useQuery<{ tests: Test[] }>({
    queryKey: ["educator-tests"],
    queryFn: () => fetch("/api/educator/tests").then((r) => r.json()),
  })

  const { data: bankData } = useQuery<{ questions: Question[]; total: number }>({
    queryKey: ["question-bank-summary"],
    queryFn: () => fetch("/api/educator/questions?summary=1").then((r) => r.json()),
  })

  const tests = testsData?.tests ?? []
  const bankTotal = bankData?.total ?? 0
  const approvedCount = bankData?.questions?.length ?? 0

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
          <p className="text-muted-foreground">Generate questions, review them, then build and assign tests.</p>
        </div>
        <Link href="/tests/generate" className="shrink-0">
          <Button className="gap-2">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Generate </span>questions
          </Button>
        </Link>
      </div>

      {/* Question bank summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Approved questions", value: approvedCount, sub: "ready to use" },
          { label: "Tests created", value: tests.length, sub: "total" },
          { label: "Published tests", value: tests.filter((t) => t.is_published).length, sub: "visible to students" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tests list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your tests</h2>
          {bankTotal > 0 && (
            <Link href="/tests/builder">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <BookOpen className="size-3.5" /> Build new test
              </Button>
            </Link>
          )}
        </div>

        {testsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <BookOpen className="size-10 text-muted-foreground/40" />
            <p className="font-medium">No tests yet</p>
            <p className="text-sm text-muted-foreground">
              Generate questions from your documents, review them, then build a test.
            </p>
            <Link href="/tests/generate">
              <Button variant="outline" size="sm">Generate questions</Button>
            </Link>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {tests.map((test) => (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{test.title}</p>
                      <StatusBadge published={test.is_published} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{test.question_ids.length} questions</span>
                      {test.time_limit_min && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {test.time_limit_min} min
                        </span>
                      )}
                      <span>Created {formatDate(test.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/tests/${test.id}/assign`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Users className="size-3" />
                        <span className="hidden sm:inline">Assign</span>
                      </Button>
                    </Link>
                    <Link href={`/tests/${test.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <span className="hidden sm:inline">Edit</span>
                        <span className="sm:hidden">→</span>
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </section>

      {/* Pending questions review CTA */}
      {bankTotal > approvedCount && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Loader2 className="size-5 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{bankTotal - approvedCount} questions pending your review</p>
              <p className="text-xs text-muted-foreground">Review and approve generated questions before adding them to tests.</p>
            </div>
          </div>
          <Link href="/tests/review">
            <Button size="sm" variant="outline" className="shrink-0">Review now</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
