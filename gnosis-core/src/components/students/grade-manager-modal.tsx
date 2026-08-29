"use client"

import { useState } from "react"
import { Check, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StudentGrade } from "@/types"

interface Props {
  open: boolean
  onClose: () => void
  grades: StudentGrade[]
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const INPUT_CLS = cn(
  "flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none",
  "focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
)

export function GradeManagerModal({ open, onClose, grades, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  function startEdit(grade: StudentGrade) {
    setEditingId(grade.id)
    setEditValue(grade.name)
    setError("")
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue("")
    setError("")
  }

  async function commitRename(id: string) {
    const name = editValue.trim()
    if (!name) return
    setBusy(id)
    setError("")
    try {
      await onRename(id, name)
      setEditingId(null)
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to rename.")
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(id: string) {
    setBusy(id)
    setError("")
    try {
      await onDelete(id)
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to delete.")
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Manage Grades</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-6">
          {grades.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No grades yet. Create one when adding a student.
            </p>
          ) : (
            <ul className="space-y-2">
              {grades.map((grade) => (
                <li key={grade.id} className="flex items-center gap-2">
                  {editingId === grade.id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(grade.id)
                          if (e.key === "Escape") cancelEdit()
                        }}
                        className={INPUT_CLS}
                      />
                      <Button
                        size="icon-sm"
                        onClick={() => commitRename(grade.id)}
                        disabled={busy === grade.id}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={cancelEdit}>
                        <X className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 rounded-lg border border-transparent px-3 py-1.5 text-sm">
                        {grade.name}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => startEdit(grade)}
                        disabled={busy === grade.id}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        onClick={() => handleDelete(grade.id)}
                        disabled={busy === grade.id}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
