"use client"

import { useEffect, useMemo } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWizard } from "@/components/exams/wizard-context"
import { deriveSelectedNodes, equalWeights, type SelectedNode } from "@/lib/exam/utils"

// ── Component ─────────────────────────────────────────────────────────────────

export function Step2Weightage() {
  const { books, selectedNodeIds, weightages, setWeightages, goNext, goBack } = useWizard()

  const nodes = useMemo(
    () => deriveSelectedNodes(books, selectedNodeIds),
    [books, selectedNodeIds]
  )

  // Initialise equal weights on first entry
  useEffect(() => {
    if (nodes.length > 0 && Object.keys(weightages).length === 0) {
      setWeightages(equalWeights(nodes))
    }
  }, [nodes, weightages, setWeightages])

  const total = useMemo(
    () => nodes.reduce((sum, n) => sum + (weightages[n.id] ?? 0), 0),
    [nodes, weightages]
  )

  const isBalanced = total === 100

  function update(id: string, raw: string) {
    const val = Math.max(0, Math.min(100, parseInt(raw) || 0))
    setWeightages({ ...weightages, [id]: val })
  }

  function equalize() {
    setWeightages(equalWeights(nodes))
  }

  // ── Desktop table row ────────────────────────────────────────────────────

  function TableRow({ node }: { node: SelectedNode }) {
    return (
      <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
        <td className="py-3 pl-4 pr-2">
          <p className="text-sm font-medium leading-snug">{node.label}</p>
          {node.chapterLabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{node.chapterLabel}</p>
          )}
        </td>
        <td className="py-3 px-2 text-sm text-muted-foreground hidden sm:table-cell">
          {node.bookTitle}
        </td>
        <td className="py-3 pl-2 pr-4 w-28">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={100}
              value={weightages[node.id] ?? 0}
              onChange={(e) => update(node.id, e.target.value)}
              className="w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </td>
      </tr>
    )
  }

  // ── Mobile card ──────────────────────────────────────────────────────────

  function MobileCard({ node }: { node: SelectedNode }) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{node.label}</p>
          {node.chapterLabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{node.chapterLabel}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{node.bookTitle}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0}
            max={100}
            value={weightages[node.id] ?? 0}
            onChange={(e) => update(node.id, e.target.value)}
            className="w-16 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Weightage Distribution</h2>
        <p className="text-sm text-muted-foreground">
          Set how many questions come from each section. Total must equal 100%.
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="py-2.5 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground">Section</th>
              <th className="py-2.5 px-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Book</th>
              <th className="py-2.5 pl-2 pr-4 text-right text-xs font-medium text-muted-foreground">Weight</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => <TableRow key={n.id} node={n} />)}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {nodes.map((n) => <MobileCard key={n.id} node={n} />)}
      </div>

      {/* Total + warning */}
      <div className={cn(
        "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium border",
        isBalanced
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
      )}>
        <span>Total: {total}%</span>
        {!isBalanced && (
          <span className="text-xs font-normal">
            {total < 100 ? `${100 - total}% remaining` : `${total - 100}% over — will be normalized`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={equalize}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="size-3.5" />
            Equalize
          </Button>
        </div>
        <Button onClick={goNext}>Continue</Button>
      </div>
    </div>
  )
}
