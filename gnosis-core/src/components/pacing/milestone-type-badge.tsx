"use client"

import type { MilestoneType } from "@/types"
import { cn } from "@/lib/utils"

const TYPE_CONFIG: Record<MilestoneType, { label: string; classes: string }> = {
  teach:  { label: "Teach",  classes: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  revise: { label: "Revise", classes: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  assess: { label: "Assess", classes: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
}

const CYCLE: Record<MilestoneType, MilestoneType> = {
  teach: "revise",
  revise: "assess",
  assess: "teach",
}

interface MilestoneTypeBadgeProps {
  type: MilestoneType
  onChange?: (next: MilestoneType) => void
  readonly?: boolean
  saving?: boolean
}

export function MilestoneTypeBadge({ type, onChange, readonly, saving }: MilestoneTypeBadgeProps) {
  const config = TYPE_CONFIG[type]

  if (readonly || !onChange) {
    return (
      <span className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        config.classes,
      )}>
        {config.label}
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => onChange(CYCLE[type])}
      title="Click to change type"
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        config.classes,
      )}
    >
      {saving ? "…" : config.label}
    </button>
  )
}
