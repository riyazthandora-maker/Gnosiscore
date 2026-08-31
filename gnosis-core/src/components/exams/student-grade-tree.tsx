"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, Users, User, CheckSquare, Square, MinusSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RosterEntry, StudentGrade } from "@/types"

interface StudentGradeTreeProps {
  grades: StudentGrade[]
  students: RosterEntry[]
  selected: Set<string>             // set of student_roster ids
  onToggleStudent: (id: string) => void
  onToggleGrade: (gradeId: string | null, studentIds: string[]) => void
}

export function StudentGradeTree({
  grades,
  students,
  selected,
  onToggleStudent,
  onToggleGrade,
}: StudentGradeTreeProps) {
  const [expandedGrades, setExpandedGrades] = useState<Set<string | null>>(new Set(grades.map(g => g.id)))

  const ungradedStudents = students.filter(s => !s.grade_id)
  const gradeMap = new Map<string | null, RosterEntry[]>()
  gradeMap.set(null, ungradedStudents)
  for (const grade of grades) {
    gradeMap.set(grade.id, students.filter(s => s.grade_id === grade.id))
  }

  const toggleExpand = (id: string | null) => {
    setExpandedGrades(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const gradeSelectionState = (gradeStudents: RosterEntry[]): "all" | "none" | "partial" => {
    if (gradeStudents.length === 0) return "none"
    const selectedCount = gradeStudents.filter(s => selected.has(s.id)).length
    if (selectedCount === 0) return "none"
    if (selectedCount === gradeStudents.length) return "all"
    return "partial"
  }

  const renderGradeGroup = (gradeId: string | null, label: string, gradeStudents: RosterEntry[]) => {
    if (gradeStudents.length === 0) return null
    const state = gradeSelectionState(gradeStudents)
    const isExpanded = expandedGrades.has(gradeId)
    const ids = gradeStudents.map(s => s.id)

    return (
      <div key={gradeId ?? "__ungraded"} className="rounded-xl border border-border overflow-hidden">
        {/* Grade row */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 cursor-pointer select-none">
          <button
            onClick={() => onToggleGrade(gradeId, ids)}
            className="shrink-0"
            aria-label={`Toggle all in ${label}`}
          >
            {state === "all"
              ? <CheckSquare className="size-4 text-primary" />
              : state === "partial"
                ? <MinusSquare className="size-4 text-primary/70" />
                : <Square className="size-4 text-muted-foreground" />
            }
          </button>
          <button
            onClick={() => toggleExpand(gradeId)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <Users className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground ml-auto mr-1">
              {gradeStudents.filter(s => selected.has(s.id)).length}/{gradeStudents.length}
            </span>
            {isExpanded
              ? <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            }
          </button>
        </div>

        {/* Students */}
        {isExpanded && (
          <div className="divide-y divide-border">
            {gradeStudents.map(student => {
              const checked = selected.has(student.id)
              return (
                <button
                  key={student.id}
                  onClick={() => onToggleStudent(student.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    checked ? "bg-primary/5" : "hover:bg-accent"
                  )}
                >
                  {checked
                    ? <CheckSquare className="size-4 shrink-0 text-primary" />
                    : <Square className="size-4 shrink-0 text-muted-foreground" />
                  }
                  <User className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                  </div>
                  <span className={cn(
                    "ml-auto shrink-0 text-xs px-1.5 py-0.5 rounded-full",
                    student.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  )}>
                    {student.status}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
      {grades.map(g => renderGradeGroup(g.id, g.name, gradeMap.get(g.id) ?? []))}
      {ungradedStudents.length > 0 && renderGradeGroup(null, "Ungraded", ungradedStudents)}
      {students.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground">No students in your roster.</p>
        </div>
      )}
      {selected.size > 0 && (
        <p className="text-xs text-primary font-medium">
          {selected.size} student{selected.size !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  )
}
