"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StudentGrade } from "@/types"

interface Props {
  grades: StudentGrade[]
  value: string | null       // grade_id
  valueName?: string         // grade name for display when value is set
  onChange: (gradeId: string | null, gradeName?: string) => void
  onCreateGrade: (name: string) => Promise<StudentGrade>
  disabled?: boolean
}

export function CreatableGradeSelect({ grades, value, valueName, onChange, onCreateGrade, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedGrade = value ? grades.find((g) => g.id === value) : null
  const displayName = selectedGrade?.name ?? valueName ?? ""

  const filtered = inputValue.trim()
    ? grades.filter((g) => g.name.toLowerCase().includes(inputValue.trim().toLowerCase()))
    : grades

  const exactMatch = grades.some(
    (g) => g.name.toLowerCase() === inputValue.trim().toLowerCase()
  )
  const showCreate = inputValue.trim().length > 0 && !exactMatch

  // Close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setInputValue("")
      }
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [])

  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setInputValue("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function selectGrade(grade: StudentGrade) {
    onChange(grade.id, grade.name)
    setOpen(false)
    setInputValue("")
  }

  function clearGrade(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
  }

  async function handleCreate() {
    const name = inputValue.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const newGrade = await onCreateGrade(name)
      onChange(newGrade.id, newGrade.name)
      setOpen(false)
      setInputValue("")
    } catch {
      // error handled by parent
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{value ? displayName : "Select or create a grade…"}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={clearGrade}
              className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3" />
            </span>
          )}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
          {/* Search input */}
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search or type new grade…"
              className="w-full rounded-md bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setInputValue("") }
                if (e.key === "Enter" && showCreate) handleCreate()
              }}
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {/* Create option */}
            {showCreate && (
              <li>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  {creating ? "Creating…" : `Add "${inputValue.trim()}"`}
                </button>
              </li>
            )}

            {/* Existing grades */}
            {filtered.map((grade) => (
              <li key={grade.id}>
                <button
                  type="button"
                  onClick={() => selectGrade(grade)}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-sm hover:bg-muted",
                    value === grade.id && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  {grade.name}
                </button>
              </li>
            ))}

            {filtered.length === 0 && !showCreate && (
              <li className="px-3 py-3 text-center text-sm text-muted-foreground">
                No grades yet. Type to create one.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
