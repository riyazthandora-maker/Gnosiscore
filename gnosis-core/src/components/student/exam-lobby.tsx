"use client"

import { useState } from "react"
import { Clock, RotateCcw, Shield, Flag, BookOpen, Loader2 } from "lucide-react"

interface ExamLobbyProps {
  examTitle: string
  durationMinutes: number
  maxAttempts: number
  attemptNumber: number
  browserLockdown: boolean
  disableCopyPaste: boolean
  tabSwitchWarnings: boolean
  tabSwitchLimit: number
  allowBacktrack: boolean
  mandatoryAnswering: boolean
  flagForReview: boolean
  onStart: () => Promise<void>
}

export function ExamLobby({
  examTitle,
  durationMinutes,
  maxAttempts,
  attemptNumber,
  browserLockdown,
  disableCopyPaste,
  tabSwitchWarnings,
  tabSwitchLimit,
  allowBacktrack,
  mandatoryAnswering,
  flagForReview,
  onStart,
}: ExamLobbyProps) {
  const [starting, setStarting] = useState(false)

  const handleStart = async () => {
    setStarting(true)
    await onStart()
    setStarting(false)
  }

  const securityItems = [
    browserLockdown && "Full-screen mode will be enabled",
    disableCopyPaste && "Copying, pasting, and printing are disabled",
    tabSwitchWarnings && `Switching tabs is monitored — exam auto-submits after ${tabSwitchLimit} switch${tabSwitchLimit !== 1 ? "es" : ""}`,
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-col items-center gap-6 max-w-xl mx-auto py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <BookOpen className="size-10 text-primary" />
        <h1 className="text-2xl font-bold">{examTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Attempt {attemptNumber} of {maxAttempts}
        </p>
      </div>

      {/* Config summary */}
      <div className="w-full rounded-xl border border-border divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Clock className="size-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Time Limit</p>
            <p className="text-xs text-muted-foreground">{durationMinutes} minutes — timer starts when you begin</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <RotateCcw className="size-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Navigation</p>
            <p className="text-xs text-muted-foreground">
              {allowBacktrack ? "You can go back to previous questions" : "You cannot return to previous questions"}
              {mandatoryAnswering ? " · Answering required before moving on" : ""}
              {flagForReview ? " · You can flag questions for review" : ""}
            </p>
          </div>
        </div>
        {securityItems.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3">
            <Shield className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Security Restrictions</p>
              <ul className="mt-1 space-y-0.5">
                {securityItems.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {flagForReview && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Flag className="size-4 text-blue-500 shrink-0" />
            <p className="text-xs text-muted-foreground">Use the flag button to mark unsure questions before final submission</p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Once you click Start, the countdown begins. Make sure you&apos;re ready.
      </p>

      <button
        onClick={handleStart}
        disabled={starting}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {starting ? (
          <><Loader2 className="size-5 animate-spin" /> Starting…</>
        ) : "Start Exam →"}
      </button>
    </div>
  )
}
