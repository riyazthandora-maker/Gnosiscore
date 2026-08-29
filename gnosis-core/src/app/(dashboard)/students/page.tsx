"use client"

import { useCallback, useEffect, useState } from "react"
import { GraduationCap, Plus, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudentFormModal } from "@/components/students/student-form-modal"
import { GradeManagerModal } from "@/components/students/grade-manager-modal"
import { StudentsTable } from "@/components/students/students-table"
import { StudentCard } from "@/components/students/student-card"
import { cn } from "@/lib/utils"
import type { RosterEntry, StudentGrade } from "@/types"

const INPUT_CLS = cn(
  "rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none",
  "placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
)

export default function StudentsPage() {
  const [students, setStudents] = useState<RosterEntry[]>([])
  const [grades, setGrades] = useState<StudentGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterGrade, setFilterGrade] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<RosterEntry | null>(null)
  const [gradeManagerOpen, setGradeManagerOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ view: "roster" })
      if (search) params.set("search", search)
      if (filterGrade) params.set("grade_id", filterGrade)
      if (filterStatus) params.set("status", filterStatus)

      const [studentsRes, gradesRes] = await Promise.all([
        fetch(`/api/educator/students?${params}`),
        fetch("/api/educator/grades"),
      ])
      const { students: s } = await studentsRes.json()
      const { grades: g } = await gradesRes.json()
      setStudents(s ?? [])
      setGrades(g ?? [])
    } catch {
      showToast("Failed to load data.", "error")
    } finally {
      setLoading(false)
    }
  }, [search, filterGrade, filterStatus])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSave(data: {
    name: string
    email: string
    phone: string
    grade_id: string | null
    grade_name?: string
  }) {
    if (editEntry) {
      const res = await fetch(`/api/educator/students/${editEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to update.")
      showToast("Student updated.")
    } else {
      const res = await fetch("/api/educator/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to add student.")
      showToast(json.linked ? "Student linked to your class." : "Invite sent!")
    }
    fetchAll()
  }

  async function handleDelete(entry: RosterEntry) {
    if (!confirm(`Remove ${entry.name} from your roster?`)) return
    const res = await fetch(`/api/educator/students/${entry.id}`, { method: "DELETE" })
    if (!res.ok) {
      const json = await res.json()
      showToast(json.error ?? "Failed to remove.", "error")
      return
    }
    showToast("Student removed.")
    fetchAll()
  }

  async function handleResendInvite(entry: RosterEntry) {
    const res = await fetch(`/api/educator/students/${entry.id}`, { method: "POST" })
    if (!res.ok) {
      const json = await res.json()
      showToast(json.error ?? "Failed to resend.", "error")
      return
    }
    showToast("Invite resent!")
  }

  async function handleCreateGrade(name: string): Promise<StudentGrade> {
    const res = await fetch("/api/educator/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Failed to create grade.")
    const newGrade = json.grade as StudentGrade
    setGrades((prev) => [...prev, newGrade].sort((a, b) => a.name.localeCompare(b.name)))
    return newGrade
  }

  async function handleRenameGrade(id: string, name: string) {
    const res = await fetch(`/api/educator/grades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Failed to rename.")
    setGrades((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)))
    setStudents((prev) => prev.map((s) => s.grade_id === id ? { ...s, grade: s.grade ? { ...s.grade, name } : null } : s))
  }

  async function handleDeleteGrade(id: string) {
    const res = await fetch(`/api/educator/grades/${id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Failed to delete.")
    setGrades((prev) => prev.filter((g) => g.id !== id))
  }

  function openAdd() {
    setEditEntry(null)
    setFormOpen(true)
  }

  function openEdit(entry: RosterEntry) {
    setEditEntry(entry)
    setFormOpen(true)
  }

  const activeCount = students.filter((s) => s.status === "active").length
  const invitedCount = students.filter((s) => s.status === "invited").length

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            Students
          </h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} active · {invitedCount} pending invite
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setGradeManagerOpen(true)}>
            <Settings2 className="size-4" />
            Manage Grades
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className={cn(INPUT_CLS, "flex-1 min-w-48")}
        />
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className={cn(INPUT_CLS, "min-w-36")}
        >
          <option value="">All Grades</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={cn(INPUT_CLS, "min-w-36")}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invite Pending</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <StudentsTable
              entries={students}
              onEdit={openEdit}
              onDelete={handleDelete}
              onResendInvite={handleResendInvite}
            />
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {students.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No students found.</p>
              </div>
            ) : (
              students.map((entry) => (
                <StudentCard
                  key={entry.id}
                  entry={entry}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onResendInvite={handleResendInvite}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Mobile sticky add button */}
      <div className="fixed bottom-4 right-4 md:hidden z-30">
        <Button onClick={openAdd} size="lg" className="rounded-full shadow-lg px-5">
          <Plus className="size-5" />
          Add Student
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg",
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-destructive text-destructive-foreground"
          )}
        >
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {formOpen && (
        <StudentFormModal
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          onCreateGrade={handleCreateGrade}
          grades={grades}
          entry={editEntry}
        />
      )}
      <GradeManagerModal
        open={gradeManagerOpen}
        onClose={() => setGradeManagerOpen(false)}
        grades={grades}
        onRename={handleRenameGrade}
        onDelete={handleDeleteGrade}
      />
    </div>
  )
}
