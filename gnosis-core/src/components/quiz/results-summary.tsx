"use client"

// Phase 5 rewrite: results summary for student test completion.
// Will be rebuilt against the new test_attempts schema.
export function ResultsSummary({ attemptId }: { attemptId: string }) {
  void attemptId
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-muted-foreground text-sm">Results summary — Phase 5</p>
    </div>
  )
}
