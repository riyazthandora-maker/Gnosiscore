import { describe, expect, it } from "vitest"
import { firstAttempt, isCompleted, meanPct, scorePct, type SessionScoreRow } from "./scoring"

function session(over: Partial<SessionScoreRow> = {}): SessionScoreRow {
  return {
    status: "submitted",
    score: null,
    max_score: null,
    attempt_number: 1,
    completed_at: "2026-09-01T00:00:00.000Z",
    ...over,
  }
}

describe("isCompleted", () => {
  it("accepts both terminal submission statuses", () => {
    expect(isCompleted("submitted")).toBe(true)
    expect(isCompleted("auto_submitted")).toBe(true)
  })

  it("rejects in-flight statuses", () => {
    expect(isCompleted("lobby")).toBe(false)
    expect(isCompleted("in_progress")).toBe(false)
    expect(isCompleted("paused")).toBe(false)
  })
})

describe("scorePct", () => {
  it("rounds a normal score", () => {
    expect(scorePct({ score: 3, max_score: 10 })).toBe(30)
    expect(scorePct({ score: 2, max_score: 3 })).toBe(67)
  })

  it("returns null when the score is missing or max_score is unusable", () => {
    expect(scorePct({ score: null, max_score: 10 })).toBe(null)
    expect(scorePct({ score: 5, max_score: null })).toBe(null)
    expect(scorePct({ score: 5, max_score: 0 })).toBe(null)
  })

  it("handles a zero score as a real result, not a missing one", () => {
    expect(scorePct({ score: 0, max_score: 5 })).toBe(0)
  })
})

describe("firstAttempt", () => {
  it("picks the lowest attempt_number among completed sessions", () => {
    const sessions = [
      session({ attempt_number: 2, score: 9, max_score: 10 }),
      session({ attempt_number: 1, score: 4, max_score: 10 }),
      session({ attempt_number: 3, score: 10, max_score: 10 }),
    ]
    expect(firstAttempt(sessions)?.attempt_number).toBe(1)
  })

  it("ignores attempts that were never completed", () => {
    const sessions = [
      session({ attempt_number: 1, status: "in_progress" }),
      session({ attempt_number: 2, status: "paused" }),
      session({ attempt_number: 3, score: 6, max_score: 10 }),
    ]
    expect(firstAttempt(sessions)?.attempt_number).toBe(3)
  })

  it("returns null when nothing has been completed", () => {
    expect(firstAttempt([session({ status: "lobby" })])).toBe(null)
    expect(firstAttempt([])).toBe(null)
  })

  it("preserves extra fields on the returned row", () => {
    const rows = [{ ...session({ attempt_number: 1 }), id: "abc", answers: { q1: "A" } }]
    expect(firstAttempt(rows)?.id).toBe("abc")
  })
})

describe("meanPct", () => {
  it("averages and rounds", () => {
    expect(meanPct([30, 40])).toBe(35)
    expect(meanPct([30, 31])).toBe(31)
  })

  it("returns null for an empty set", () => {
    expect(meanPct([])).toBe(null)
  })
})
