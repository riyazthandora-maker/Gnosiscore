"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

function getAcademicYears() {
  const now = new Date()
  const y = now.getFullYear()
  return [`${y - 1}-${y}`, `${y}-${y + 1}`, `${y + 1}-${y + 2}`]
}

interface Book  { id: string; title: string }
interface Grade { id: string; name: string }

interface CreatePlanFormProps {
  books:  Book[]
  grades: Grade[]
}

export function CreatePlanForm({ books, grades }: CreatePlanFormProps) {
  const router = useRouter()
  const years = getAcademicYears()

  const [bookId,       setBookId]       = useState(books[0]?.id  ?? "")
  const [gradeId,      setGradeId]      = useState(grades[0]?.id ?? "")
  const [title,        setTitle]        = useState("")
  const [academicYear, setAcademicYear] = useState(years[1])
  const [startMonth,   setStartMonth]   = useState(1)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!bookId)  { setError("Please select a book."); return }
    if (!gradeId) { setError("Please select a grade."); return }
    if (!title.trim()) { setError("Please enter a plan title."); return }

    setLoading(true)
    const res = await fetch("/api/educator/pacing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), book_id: bookId, grade_id: gradeId, academic_year: academicYear, start_month: startMonth }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? "Failed to create plan."); return }
    router.push(`/exams/pacing/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {/* Book */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Book</label>
        {books.length === 0 ? (
          <p className="text-sm text-destructive">No books found. Create a book first.</p>
        ) : (
          <select
            value={bookId}
            onChange={e => setBookId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        )}
      </div>

      {/* Grade */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class / Grade</label>
        {grades.length === 0 ? (
          <p className="text-sm text-destructive">No grades found. Create a grade in Student Management first.</p>
        ) : (
          <select
            value={gradeId}
            onChange={e => setGradeId(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </div>

      {/* Academic Year + Start Month */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Academic Year</label>
          <select
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Starts In</label>
          <select
            value={startMonth}
            onChange={e => setStartMonth(Number(e.target.value))}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={`e.g. Physics — Grade 9 — ${academicYear}`}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={loading || books.length === 0 || grades.length === 0}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Create Plan"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
