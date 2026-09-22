import { cn } from "@/lib/utils"
import type { DifficultyBands } from "@/types"

interface Props {
  score: number | null
  bands: DifficultyBands
  className?: string
}

export function ScoreBadge({ score, bands, className }: Props) {
  if (score === null || score === undefined) {
    return <span className={cn("text-sm text-muted-foreground", className)}>—</span>
  }

  const color =
    score >= bands.high[0]   ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
    score >= bands.low[0]    ? "bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-400"  :
                               "bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400"

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", color, className)}>
      {score.toFixed(1)}%
    </span>
  )
}
