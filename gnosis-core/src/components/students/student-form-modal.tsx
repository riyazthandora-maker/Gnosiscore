"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreatableGradeSelect } from "@/components/students/creatable-grade-select"
import { cn } from "@/lib/utils"
import type { RosterEntry, StudentGrade } from "@/types"

interface Props {
  onClose: () => void
  onSave: (data: {
    name: string
    email: string
    phone: string
    grade_id: string | null
    grade_name?: string
  }) => Promise<void>
  onCreateGrade: (name: string) => Promise<StudentGrade>
  grades: StudentGrade[]
  entry?: RosterEntry | null
}

const INPUT_CLS = cn(
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none",
  "placeholder:text-muted-foreground",
  "focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
)

export function StudentFormModal({ onClose, onSave, onCreateGrade, grades, entry }: Props) {
  const [name, setName] = useState(entry?.name ?? "")
  const [email, setEmail] = useState(entry?.email ?? "")
  const [phone, setPhone] = useState(entry?.phone ?? "")
  const [gradeId, setGradeId] = useState<string | null>(entry?.grade_id ?? null)
  const [gradeName, setGradeName] = useState<string | undefined>(entry?.grade?.name ?? undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const nameRef = useRef<HTMLInputElement>(null)
  const isEdit = !!entry

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await onSave({ name: name.trim(), email: email.trim(), phone: phone.trim(), grade_id: gradeId, grade_name: gradeName })
      onClose()
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  function handleGradeChange(id: string | null, name?: string) {
    setGradeId(id)
    setGradeName(name)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{isEdit ? "Edit Student" : "Add Student"}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Full Name <span className="text-destructive">*</span></label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arjun Sharma"
              required
              autoFocus
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Email <span className="text-destructive">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              required
              disabled={isEdit && entry?.status === "active"}
              className={cn(INPUT_CLS, isEdit && entry?.status === "active" && "opacity-60")}
            />
            {isEdit && entry?.status === "active" && (
              <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed after the student joins.</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Grade <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
            <CreatableGradeSelect
              grades={grades}
              value={gradeId}
              valueName={gradeName}
              onChange={handleGradeChange}
              onCreateGrade={onCreateGrade}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Student"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
