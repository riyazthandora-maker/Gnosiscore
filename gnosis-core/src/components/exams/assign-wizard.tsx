"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react"
import { ExamSelectPanel } from "./exam-select-panel"
import { StudentGradeTree } from "./student-grade-tree"
import { AssignmentConfigForm, DEFAULT_CONFIG, type AssignmentConfig } from "./assignment-config-form"
import type { RosterEntry, StudentGrade } from "@/types"

interface ExamSummary {
  id: string
  title: string
  created_at: string
  question_count: number
}

interface AssignWizardProps {
  exams: ExamSummary[]
  grades: StudentGrade[]
  students: RosterEntry[]
  preselectedExamId?: string
}

const STEPS = ["Select Exams", "Select Students", "Configure"]

export function AssignWizard({ exams, grades, students, preselectedExamId }: AssignWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [selectedExams, setSelectedExams] = useState<Set<string>>(
    preselectedExamId ? new Set([preselectedExamId]) : new Set()
  )
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [config, setConfig] = useState<AssignmentConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleExam = useCallback((id: string) => {
    setSelectedExams(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleStudent = useCallback((id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleGrade = useCallback((_gradeId: string | null, ids: string[]) => {
    setSelectedStudents(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => next.has(id))
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }, [])

  const canNext = step === 0
    ? selectedExams.size > 0
    : step === 1
      ? selectedStudents.size > 0
      : true

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/educator/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_ids: [...selectedExams],
          student_roster_ids: [...selectedStudents],
          config: {
            ...config,
            starts_at: config.starts_at || null,
            ends_at: config.ends_at || null,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to assign")
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    const assignedCount = selectedExams.size * selectedStudents.size
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <h2 className="text-xl font-semibold">Assignments Created</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {assignedCount} assignment{assignedCount !== 1 ? "s" : ""} created and students have been notified by email.
        </p>
        <button
          onClick={() => router.push("/exams")}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back to Exams
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center size-6 rounded-full text-xs font-bold transition-colors ${
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card p-5">
        {step === 0 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Select Exams</h2>
            <ExamSelectPanel
              exams={exams}
              selected={selectedExams}
              onToggle={toggleExam}
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Select Students</h2>
            <StudentGradeTree
              grades={grades}
              students={students}
              selected={selectedStudents}
              onToggleStudent={toggleStudent}
              onToggleGrade={toggleGrade}
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold mb-4">Configure Assignment</h2>
            <AssignmentConfigForm config={config} onChange={setConfig} />
          </div>
        )}
      </div>

      {/* Summary bar */}
      {(selectedExams.size > 0 || selectedStudents.size > 0) && (
        <div className="flex gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-2">
          {selectedExams.size > 0 && <span>{selectedExams.size} exam{selectedExams.size !== 1 ? "s" : ""}</span>}
          {selectedExams.size > 0 && selectedStudents.size > 0 && <span>·</span>}
          {selectedStudents.size > 0 && <span>{selectedStudents.size} student{selectedStudents.size !== 1 ? "s" : ""}</span>}
          {selectedExams.size > 0 && selectedStudents.size > 0 && (
            <span className="ml-auto font-medium text-foreground">
              = {selectedExams.size * selectedStudents.size} total assignment{selectedExams.size * selectedStudents.size !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || selectedExams.size === 0 || selectedStudents.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? (
              <><Loader2 className="size-4 animate-spin" /> Assigning…</>
            ) : (
              <><Send className="size-4" /> Assign Now</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
