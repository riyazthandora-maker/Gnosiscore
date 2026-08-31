"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ExamLobby } from "./exam-lobby"
import { ExamTaker } from "./exam-taker"
import { ExamResults } from "./exam-results"
import type { ExamQuestion } from "@/types"

interface ExamConfig {
  duration_minutes: number
  max_attempts: number
  randomize_questions: boolean
  shuffle_answers: boolean
  allow_backtrack: boolean
  mandatory_answering: boolean
  flag_for_review: boolean
  browser_lockdown: boolean
  disable_copy_paste: boolean
  tab_switch_warnings: boolean
  tab_switch_limit: number
  release_results_immediately: boolean
  show_explanations: boolean
  threshold_excellent: number
  threshold_distinction: number
  threshold_pass: number
}

interface ExamControllerProps {
  assignmentId: string
  examTitle: string
  questions: ExamQuestion[]
  existingSession: Record<string, unknown> | null
  attemptNumber: number
  config: ExamConfig
}

type Phase = "lobby" | "taking" | "results"

export function ExamController({
  assignmentId,
  examTitle,
  questions,
  existingSession,
  attemptNumber,
  config,
}: ExamControllerProps) {
  const router = useRouter()

  const initialPhase: Phase =
    existingSession?.status === "in_progress" || existingSession?.status === "paused"
      ? "taking"
      : "lobby"

  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [sessionId, setSessionId] = useState<string>(
    (existingSession?.id as string | undefined) ?? ""
  )
  const [results, setResults] = useState<{ score: number; maxScore: number; answers: Record<string, string> } | null>(null)

  const handleStart = async () => {
    // Create or fetch session
    const res = await fetch(`/api/student/exam/${assignmentId}/session`, {
      method: "POST",
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to start")

    const sid = data.session.id as string
    setSessionId(sid)

    // Transition to in_progress
    await fetch(`/api/student/exam/${assignmentId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid, action: "start" }),
    })

    setPhase("taking")
  }

  const handleComplete = (result: { score: number; maxScore: number; answers: Record<string, string> }) => {
    setResults(result)
    setPhase("results")
  }

  if (phase === "lobby") {
    return (
      <ExamLobby
        examTitle={examTitle}
        durationMinutes={config.duration_minutes}
        maxAttempts={config.max_attempts}
        attemptNumber={attemptNumber}
        browserLockdown={config.browser_lockdown}
        disableCopyPaste={config.disable_copy_paste}
        tabSwitchWarnings={config.tab_switch_warnings}
        tabSwitchLimit={config.tab_switch_limit}
        allowBacktrack={config.allow_backtrack}
        mandatoryAnswering={config.mandatory_answering}
        flagForReview={config.flag_for_review}
        onStart={handleStart}
      />
    )
  }

  if (phase === "taking") {
    const savedAnswers = (existingSession?.answers as Record<string, string> | undefined) ?? {}
    const savedFlagged = (existingSession?.flagged_questions as string[] | undefined) ?? []
    const savedElapsed = (existingSession?.elapsed_seconds as number | undefined) ?? 0

    return (
      <ExamTaker
        assignmentId={assignmentId}
        sessionId={sessionId}
        questions={questions}
        initialAnswers={savedAnswers}
        initialFlagged={savedFlagged}
        initialElapsed={savedElapsed}
        durationMinutes={config.duration_minutes}
        allowBacktrack={config.allow_backtrack}
        mandatoryAnswering={config.mandatory_answering}
        flagForReview={config.flag_for_review}
        randomizeQuestions={config.randomize_questions}
        shuffleAnswers={config.shuffle_answers}
        browserLockdown={config.browser_lockdown}
        disableCopyPaste={config.disable_copy_paste}
        tabSwitchWarnings={config.tab_switch_warnings}
        tabSwitchLimit={config.tab_switch_limit}
        onComplete={handleComplete}
      />
    )
  }

  // Results phase
  return (
    <ExamResults
      examTitle={examTitle}
      score={results?.score ?? 0}
      maxScore={results?.maxScore ?? questions.length}
      thresholdExcellent={config.threshold_excellent}
      thresholdDistinction={config.threshold_distinction}
      thresholdPass={config.threshold_pass}
      releaseResultsImmediately={config.release_results_immediately}
      showExplanations={config.show_explanations}
      questions={questions}
      answers={results?.answers ?? {}}
      onDone={() => router.push("/student")}
    />
  )
}
