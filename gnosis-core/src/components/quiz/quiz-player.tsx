"use client"

import { Loader2 } from "lucide-react"

// Phase 5 rewrite: quiz player for student test-taking flow.
// Will be rebuilt against the new test_attempts + questions schema.
export function QuizPlayer({ attemptId }: { attemptId: string }) {
  void attemptId
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Quiz player — Phase 5</p>
    </div>
  )
}
