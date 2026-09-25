export interface SessionScoreRow {
  status: string
  score: number | null
  max_score: number | null
  attempt_number: number
  completed_at: string | null
}

export function isCompleted(status: string): boolean {
  return status === "submitted" || status === "auto_submitted"
}

/** Percentage score, or null when the session has no usable score. */
export function scorePct(session: Pick<SessionScoreRow, "score" | "max_score">): number | null {
  const { score, max_score } = session
  if (score === null || max_score === null || max_score <= 0) return null
  return Math.round((score / max_score) * 100)
}

/**
 * The first attempt on an assignment: the completed session with the lowest
 * attempt_number. Counting every attempt would let retakes inflate completion
 * counts past the number of exams actually assigned.
 */
export function firstAttempt<T extends SessionScoreRow>(sessions: T[]): T | null {
  let best: T | null = null
  for (const session of sessions) {
    if (!isCompleted(session.status)) continue
    if (!best || session.attempt_number < best.attempt_number) best = session
  }
  return best
}

/** Mean of the given percentages, rounded, or null when there are none. */
export function meanPct(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}
