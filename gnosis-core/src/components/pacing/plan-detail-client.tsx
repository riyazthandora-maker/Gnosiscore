"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { BarChart3, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Settings, Sparkles, Trash2, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NlpInput } from "./nlp-input"
import { MilestoneTypeBadge } from "./milestone-type-badge"
import { RescheduleControls } from "./reschedule-controls"
import { AutoExamReviewModal } from "./auto-exam-review-modal"
import { cn } from "@/lib/utils"
import type { MilestoneType, DifficultyBands } from "@/types"

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

interface FlatBlock { id: string; level: string; text: string }

interface Milestone {
  id: string
  node_id: string
  node_level: string
  node_title: string
  month: number
  week_in_month: number
  topic_notes: string | null
  milestone_type: MilestoneType
  auto_exam_paper_id: string | null
  auto_exam_status: string | null
}

interface MilestonePreview {
  node_id: string
  node_level: string
  node_title: string
  month: number
  week_in_month: number
}

interface Plan {
  id: string
  title: string
  academic_year: string
  start_month: number
  book_title: string
  grade_name: string
  blocks: FlatBlock[]
  auto_assess_enabled: boolean
  difficulty_bands: DifficultyBands
  auto_question_count: number
  auto_duration_minutes: number
}

interface SlotOption {
  value: string
  label: string
  month: number
  week: number
}

function buildSlotOptions(startMonth: number, academicYear: string): SlotOption[] {
  const parts = academicYear.split("-")
  const y1 = parseInt(parts[0]), y2 = parseInt(parts[1])
  const options: SlotOption[] = []
  for (let i = 0; i < 12; i++) {
    const month = ((startMonth - 1 + i) % 12) + 1
    const year = month >= startMonth ? y1 : y2
    for (let w = 1; w <= 4; w++) {
      options.push({
        value: `${month}-${w}`,
        label: `W${w} · ${MONTH_SHORT[month - 1]} ${year}`,
        month,
        week: w,
      })
    }
  }
  return options
}

function getDescendantIds(blocks: FlatBlock[], nodeId: string): string[] {
  const idx = blocks.findIndex(b => b.id === nodeId)
  if (idx === -1) return []
  const current = blocks[idx]
  const ids: string[] = []
  for (let i = idx + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (current.level === "chapter" && b.level === "chapter") break
    if (current.level === "section" && (b.level === "chapter" || b.level === "section")) break
    ids.push(b.id)
  }
  return ids
}

function blockHasChildren(blocks: FlatBlock[], index: number): boolean {
  const block = blocks[index]
  if (block.level === "details") return false
  const next = blocks[index + 1]
  if (!next) return false
  return block.level === "chapter" ? next.level !== "chapter" : next.level === "details"
}

function getVisibleBlocks(
  blocks: FlatBlock[],
  viewLevel: 1 | 2 | 3,
  collapsedIds: Set<string>,
): FlatBlock[] {
  if (viewLevel === 1) return blocks.filter((b) => b.level === "chapter")
  if (viewLevel === 2) return blocks.filter((b) => b.level !== "details")
  const visible: FlatBlock[] = []
  let chapterCollapsed = false
  let sectionCollapsed = false
  for (const block of blocks) {
    if (block.level === "chapter") {
      chapterCollapsed = collapsedIds.has(block.id)
      sectionCollapsed = false
      visible.push(block)
    } else if (block.level === "section") {
      if (chapterCollapsed) continue
      sectionCollapsed = collapsedIds.has(block.id)
      visible.push(block)
    } else {
      if (chapterCollapsed || sectionCollapsed) continue
      visible.push(block)
    }
  }
  return visible
}

interface AssignmentEntry {
  dbId: string
  month: number
  week: number
  milestoneType: MilestoneType
  autoExamPaperId: string | null
  autoExamStatus: string | null
}

export function PlanDetailClient({ plan, initialMilestones }: {
  plan: Plan
  initialMilestones: Milestone[]
}) {
  const [assignments, setAssignments] = useState<Map<string, AssignmentEntry>>(() => {
    const map = new Map<string, AssignmentEntry>()
    initialMilestones.forEach(m => {
      map.set(m.node_id, {
        dbId: m.id,
        month: m.month,
        week: m.week_in_month,
        milestoneType: m.milestone_type ?? "teach",
        autoExamPaperId: m.auto_exam_paper_id,
        autoExamStatus: m.auto_exam_status,
      })
    })
    return map
  })

  const [autoPacing, setAutoPacing] = useState(false)
  const [autoPaceError, setAutoPaceError] = useState("")
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savingTypeIds, setSavingTypeIds] = useState<Set<string>>(new Set())
  const [actingAutoIds, setActingAutoIds] = useState<Set<string>>(new Set())
  const [reviewEntry, setReviewEntry] = useState<{ nodeId: string; milestoneId: string; nodeTitle: string } | null>(null)
  const [bulkTypeSaving, setBulkTypeSaving] = useState(false)
  const [autoExamErrors, setAutoExamErrors] = useState<Map<string, string>>(new Map())
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  // ── Settings panel state ─────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autoAssessEnabled, setAutoAssessEnabled] = useState(plan.auto_assess_enabled)
  const [autoQuestionCount, setAutoQuestionCount] = useState(plan.auto_question_count)
  const [autoDurationMinutes, setAutoDurationMinutes] = useState(plan.auto_duration_minutes)
  const [bandLow, setBandLow] = useState(plan.difficulty_bands.low[0])
  const [bandMedium, setBandMedium] = useState(plan.difficulty_bands.medium[0])
  const [bandHigh, setBandHigh] = useState(plan.difficulty_bands.high[0])
  const [savingSettings, setSavingSettings] = useState(false)

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const slotOptions = useMemo(
    () => buildSlotOptions(plan.start_month, plan.academic_year),
    [plan.start_month, plan.academic_year]
  )

  const blocksWithChildren = useMemo(() => {
    const set = new Set<string>()
    plan.blocks.forEach((_, i) => {
      if (blockHasChildren(plan.blocks, i)) set.add(plan.blocks[i].id)
    })
    return set
  }, [plan.blocks])

  const allCollapsed = blocksWithChildren.size > 0 && collapsedIds.size >= blocksWithChildren.size

  function toggleCollapseAll() {
    if (allCollapsed) {
      setCollapsedIds(new Set())
    } else {
      setCollapsedIds(new Set(blocksWithChildren))
    }
  }

  const visibleBlocks = useMemo(
    () => getVisibleBlocks(plan.blocks, 3, collapsedIds),
    [plan.blocks, collapsedIds],
  )

  const assignedCount = assignments.size
  const totalNodes = plan.blocks.length

  async function assignSlot(nodeId: string, month: number, week: number) {
    const block = plan.blocks.find(b => b.id === nodeId)
    if (!block) return

    // Determine all nodes to assign (cascade to children)
    const targetIds = [nodeId]
    if (block.level === "chapter" || block.level === "section") {
      targetIds.push(...getDescendantIds(plan.blocks, nodeId))
    }

    const records = targetIds.map(tid => {
      const b = plan.blocks.find(bl => bl.id === tid)!
      return { node_id: tid, node_level: b.level, node_title: b.text, month, week_in_month: week }
    })

    setSavingIds(prev => new Set([...prev, ...targetIds]))

    const res = await fetch(`/api/educator/pacing/${plan.id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records),
    })

    setSavingIds(prev => {
      const next = new Set(prev)
      targetIds.forEach(id => next.delete(id))
      return next
    })

    if (!res.ok) return
    const data = await res.json()
    const created = (data.milestones ?? []) as Milestone[]

    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        created.forEach(m => next.set(m.node_id, {
          dbId: m.id,
          month: m.month,
          week: m.week_in_month,
          milestoneType: m.milestone_type ?? "teach",
          autoExamPaperId: m.auto_exam_paper_id,
          autoExamStatus: m.auto_exam_status,
        }))
        return next
      })
    })
  }

  async function updateMilestoneType(nodeId: string, newType: MilestoneType) {
    const entry = assignments.get(nodeId)
    if (!entry) return

    setSavingTypeIds(prev => new Set([...prev, nodeId]))
    const res = await fetch(`/api/educator/pacing/${plan.id}/milestones/${entry.dbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestone_type: newType }),
    })
    setSavingTypeIds(prev => { const next = new Set(prev); next.delete(nodeId); return next })

    if (!res.ok) return
    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        const existing = next.get(nodeId)
        if (existing) next.set(nodeId, { ...existing, milestoneType: newType })
        return next
      })
    })
  }

  async function saveSettings() {
    setSavingSettings(true)
    await fetch(`/api/educator/pacing/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auto_assess_enabled: autoAssessEnabled,
        auto_question_count: autoQuestionCount,
        auto_duration_minutes: autoDurationMinutes,
        difficulty_bands: {
          low:    [bandLow,    bandMedium],
          medium: [bandMedium, bandHigh],
          high:   [bandHigh,   100],
        },
      }),
    })
    setSavingSettings(false)
    setSettingsOpen(false)
  }

  async function removeSlot(nodeId: string) {
    const block = plan.blocks.find(b => b.id === nodeId)
    if (!block) return

    // Cascade to children, same as assignSlot
    const targetIds = [nodeId]
    if (block.level === "chapter" || block.level === "section") {
      targetIds.push(...getDescendantIds(plan.blocks, nodeId))
    }

    const toDelete = targetIds.filter(id => assignments.has(id))
    if (toDelete.length === 0) return

    setSavingIds(prev => new Set([...prev, ...toDelete]))

    await Promise.all(
      toDelete.map(id => {
        const entry = assignments.get(id)!
        return fetch(`/api/educator/pacing/${plan.id}/milestones/${entry.dbId}`, { method: "DELETE" })
      })
    )

    setSavingIds(prev => {
      const next = new Set(prev)
      toDelete.forEach(id => next.delete(id))
      return next
    })

    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        toDelete.forEach(id => next.delete(id))
        return next
      })
    })
  }

  async function applyNlpMilestones(nlpMilestones: MilestonePreview[]) {
    const res = await fetch(`/api/educator/pacing/${plan.id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nlpMilestones),
    })
    if (!res.ok) return
    const data = await res.json()
    const created = (data.milestones ?? []) as Milestone[]

    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        created.forEach(m => next.set(m.node_id, {
          dbId: m.id,
          month: m.month,
          week: m.week_in_month,
          milestoneType: m.milestone_type ?? "teach",
          autoExamPaperId: m.auto_exam_paper_id,
          autoExamStatus: m.auto_exam_status,
        }))
        return next
      })
    })
  }

  async function handleAutoPace() {
    setAutoPacing(true)
    setAutoPaceError("")
    const res = await fetch(`/api/educator/pacing/${plan.id}/auto-pace`, { method: "POST" })
    const data = await res.json()
    setAutoPacing(false)
    if (!res.ok) { setAutoPaceError(data.error ?? "Auto-pace failed."); return }

    const created = (data.milestones ?? []) as Milestone[]
    startTransition(() => {
      setAssignments(() => {
        const next = new Map<string, AssignmentEntry>()
        created.forEach(m => next.set(m.node_id, {
          dbId: m.id,
          month: m.month,
          week: m.week_in_month,
          milestoneType: m.milestone_type ?? "teach",
          autoExamPaperId: m.auto_exam_paper_id,
          autoExamStatus: m.auto_exam_status,
        }))
        return next
      })
    })
  }

  async function approveAutoExam(nodeId: string) {
    const entry = assignments.get(nodeId)
    if (!entry) return
    setActingAutoIds(prev => new Set([...prev, nodeId]))
    const res = await fetch(`/api/educator/pacing/${plan.id}/milestones/${entry.dbId}/auto-exam/approve`, { method: "POST" })
    setActingAutoIds(prev => { const next = new Set(prev); next.delete(nodeId); return next })
    if (!res.ok) return
    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        const existing = next.get(nodeId)
        if (existing) next.set(nodeId, { ...existing, autoExamStatus: "assigned" })
        return next
      })
    })
  }

  async function regenerateAutoExam(nodeId: string) {
    const entry = assignments.get(nodeId)
    if (!entry) return
    setActingAutoIds(prev => new Set([...prev, nodeId]))
    const res = await fetch(`/api/educator/pacing/${plan.id}/milestones/${entry.dbId}/auto-exam/regenerate`, { method: "POST" })
    setActingAutoIds(prev => { const next = new Set(prev); next.delete(nodeId); return next })
    if (!res.ok) return
    const data = await res.json()
    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        const existing = next.get(nodeId)
        if (existing) next.set(nodeId, { ...existing, autoExamPaperId: data.paperId, autoExamStatus: "pending_review" })
        return next
      })
    })
  }

  async function manualGenerateAutoExam(nodeId: string) {
    const entry = assignments.get(nodeId)
    if (!entry) return
    setActingAutoIds(prev => new Set([...prev, nodeId]))
    setAutoExamErrors(prev => { const next = new Map(prev); next.delete(nodeId); return next })
    const res = await fetch(`/api/educator/pacing/${plan.id}/milestones/${entry.dbId}/auto-exam`, { method: "POST" })
    setActingAutoIds(prev => { const next = new Set(prev); next.delete(nodeId); return next })
    const data = await res.json()
    if (!res.ok) {
      setAutoExamErrors(prev => new Map(prev).set(nodeId, data.error ?? "Generation failed."))
      return
    }
    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        const existing = next.get(nodeId)
        if (existing) next.set(nodeId, { ...existing, autoExamPaperId: data.paperId, autoExamStatus: "pending_review" })
        return next
      })
    })
  }

  // Derive whether all chapter/section assignments share one type (for toggle highlight)
  const chapterSectionType = useMemo<MilestoneType | null>(() => {
    const types = new Set(
      [...assignments.entries()]
        .filter(([id]) => {
          const b = plan.blocks.find(bl => bl.id === id)
          return b && (b.level === "chapter" || b.level === "section")
        })
        .map(([, e]) => e.milestoneType)
    )
    if (types.size === 0) return null
    if (types.size === 1) return [...types][0] as MilestoneType
    return null // mixed
  }, [assignments, plan.blocks])

  async function bulkSetType(type: MilestoneType) {
    if (assignments.size === 0) return
    setBulkTypeSaving(true)
    const res = await fetch(`/api/educator/pacing/${plan.id}/milestones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestone_type: type, node_levels: ["chapter", "section"] }),
    })
    setBulkTypeSaving(false)
    if (!res.ok) return
    const data = await res.json()
    const updated = (data.milestones ?? []) as Milestone[]
    startTransition(() => {
      setAssignments(prev => {
        const next = new Map(prev)
        updated.forEach(m => {
          const existing = next.get(m.node_id)
          if (existing) next.set(m.node_id, { ...existing, milestoneType: (m.milestone_type ?? "teach") as MilestoneType })
        })
        return next
      })
    })
  }

  function handleSuggestionsApplied(updatedMilestones: unknown[]) {
    type RawMs = {
      id: string; node_id: string; month: number; week_in_month: number
      milestone_type: string; auto_exam_paper_id: string | null; auto_exam_status: string | null
    }
    startTransition(() => {
      setAssignments(() => {
        const next = new Map<string, AssignmentEntry>()
        ;(updatedMilestones as RawMs[]).forEach(m => next.set(m.node_id, {
          dbId:            m.id,
          month:           m.month,
          week:            m.week_in_month,
          milestoneType:   (m.milestone_type ?? "teach") as MilestoneType,
          autoExamPaperId: m.auto_exam_paper_id,
          autoExamStatus:  m.auto_exam_status,
        }))
        return next
      })
    })
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/exams/pacing" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ChevronLeft className="size-3.5" /> Pacing Plans
          </Link>
          <h1 className="text-xl font-semibold">{plan.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {plan.book_title} · {plan.grade_name} · {plan.academic_year}
            <span className="ml-2 text-foreground font-medium">{assignedCount}/{totalNodes} items scheduled</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={autoPacing || plan.blocks.length === 0}
            onClick={handleAutoPace}
          >
            <Sparkles className="size-3.5" />
            {autoPacing ? "Pacing…" : "Auto-Pace"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setSettingsOpen(o => !o)}
          >
            <Settings className="size-3.5" />
            Settings
          </Button>
          <Link
            href={`/exams/pacing/${plan.id}/analytics`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <BarChart3 className="size-3.5" />
            Analytics
          </Link>
        </div>
      </div>

      {autoPaceError && <p className="text-xs text-destructive">{autoPaceError}</p>}

      {/* Settings panel */}
      {settingsOpen && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auto-Assess Settings</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-Assess</p>
              <p className="text-xs text-muted-foreground">Generate chapter checks automatically 5 days before each Assess slot</p>
            </div>
            <button
              type="button"
              onClick={() => setAutoAssessEnabled(v => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                autoAssessEnabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                autoAssessEnabled ? "translate-x-4" : "translate-x-0"
              )} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Questions per check</label>
              <input
                type="number" min={1} max={20}
                value={autoQuestionCount}
                onChange={e => setAutoQuestionCount(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Duration (minutes)</label>
              <input
                type="number" min={1} max={60}
                value={autoDurationMinutes}
                onChange={e => setAutoDurationMinutes(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 w-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Difficulty bands — progressive question difficulty based on grade average score</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Low starts at (%)", value: bandLow, onChange: setBandLow },
                { label: "Medium starts at (%)", value: bandMedium, onChange: setBandMedium },
                { label: "High starts at (%)", value: bandHigh, onChange: setBandHigh },
              ].map(({ label, value, onChange }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    type="number" min={0} max={100}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={savingSettings} onClick={saveSettings}>
              {savingSettings ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>
      )}

      {/* Rescheduling & Remediation */}
      <RescheduleControls planId={plan.id} onApplied={handleSuggestionsApplied} />

      {/* NLP */}
      <NlpInput planId={plan.id} onApply={applyNlpMilestones} />

      {/* Book content tree */}
      {plan.blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">This book has no content blocks yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2.5 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-auto">Book Content</span>
            {assignedCount > 0 && (
              <div className={cn(
                "flex items-center rounded-md border border-border overflow-hidden text-[10px] font-semibold",
                bulkTypeSaving && "opacity-50 pointer-events-none"
              )}>
                <button
                  onClick={() => bulkSetType("teach")}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    chapterSectionType === "teach"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Teach
                </button>
                <button
                  onClick={() => bulkSetType("assess")}
                  className={cn(
                    "px-2.5 py-1 border-l border-border transition-colors",
                    chapterSectionType === "assess"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Assess
                </button>
              </div>
            )}
            <span className="text-xs text-muted-foreground">{slotOptions.length} slots available</span>
            <button
              onClick={toggleCollapseAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {visibleBlocks.map(block => {
              const entry = assignments.get(block.id)
              const slotValue = entry ? `${entry.month}-${entry.week}` : ""
              const isSaving = savingIds.has(block.id)
              const hasChildren = blocksWithChildren.has(block.id)
              const isCollapsed = collapsedIds.has(block.id)

              return (
                <div
                  key={block.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5 transition-colors",
                    block.level === "chapter" && "bg-background",
                    block.level === "section" && "bg-muted/20 pl-10",
                    block.level === "details" && "bg-muted/5 pl-16",
                    entry && "bg-primary/[0.03]",
                  )}
                >
                  {/* Title group */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Level badge */}
                  <span className={cn(
                    "shrink-0 text-[10px] font-bold uppercase tracking-widest w-6 text-center",
                    block.level === "chapter" ? "text-primary" :
                    block.level === "section" ? "text-muted-foreground" :
                    "text-muted-foreground/40"
                  )}>
                    {block.level === "chapter" ? "Ch" : block.level === "section" ? "Sc" : "·"}
                  </span>

                  {/* Collapse toggle */}
                  {block.level !== "details" ? (
                    <button
                      onClick={() => hasChildren && toggleCollapse(block.id)}
                      className={cn(
                        "shrink-0 text-muted-foreground/50 transition-colors",
                        hasChildren ? "hover:text-foreground cursor-pointer" : "opacity-0 pointer-events-none",
                      )}
                    >
                      {isCollapsed
                        ? <ChevronRight className="size-3.5" />
                        : <ChevronDown className="size-3.5" />
                      }
                    </button>
                  ) : (
                    <span className="shrink-0 w-3.5" />
                  )}

                  {/* Title */}
                  <span className={cn(
                    "flex-1 min-w-0 text-sm truncate",
                    block.level === "chapter" && "font-semibold",
                    block.level === "section" && "font-medium text-foreground/90",
                    block.level === "details" && "text-xs text-muted-foreground",
                  )}>
                    {block.text}
                  </span>
                  </div>

                  {/* Controls group */}
                  <div className="flex items-center gap-2 flex-wrap">

                  {/* Milestone type badge — only shown when assigned */}
                  {entry && (
                    <MilestoneTypeBadge
                      type={entry.milestoneType}
                      saving={savingTypeIds.has(block.id)}
                      onChange={newType => updateMilestoneType(block.id, newType)}
                    />
                  )}

                  {/* Auto-exam status + actions — only for assess-type milestones */}
                  {entry?.milestoneType === "assess" && (() => {
                    const isActing = actingAutoIds.has(block.id)
                    const status = entry.autoExamStatus

                    if (status === "assigned") {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
                          <CheckCircle2 className="size-3" /> Assigned
                        </span>
                      )
                    }

                    if (status === "pending_review") {
                      return (
                        <button
                          type="button"
                          onClick={() => setReviewEntry({ nodeId: block.id, milestoneId: entry.dbId, nodeTitle: block.text })}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md px-2 py-0.5 transition-colors"
                        >
                          <Clock className="size-3" /> Review
                        </button>
                      )
                    }

                    // No exam yet — show Generate button
                    const genError = autoExamErrors.get(block.id)
                    return (
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => manualGenerateAutoExam(block.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 border border-dashed border-border rounded-md px-2 py-0.5 transition-colors"
                        >
                          <Wand2 className="size-3" />{isActing ? "Generating…" : "Generate"}
                        </button>
                        {genError && (
                          <span className="text-[10px] text-destructive">{genError}</span>
                        )}
                      </span>
                    )
                  })()}

                  {/* Slot picker */}
                  <select
                    disabled={isSaving}
                    value={slotValue}
                    onChange={e => {
                      const val = e.target.value
                      if (!val) {
                        removeSlot(block.id)
                      } else {
                        const [m, w] = val.split("-").map(Number)
                        assignSlot(block.id, m, w)
                      }
                    }}
                    className={cn(
                      "shrink-0 rounded-lg border border-input bg-background px-2.5 py-1 text-xs outline-none",
                      "focus:border-ring focus:ring-2 focus:ring-ring/30",
                      "disabled:opacity-50 transition-opacity",
                      entry ? "border-primary/30 text-primary font-medium" : "text-muted-foreground"
                    )}
                  >
                    <option value="">— Not assigned —</option>
                    {slotOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Danger actions */}
      <div className="pt-2 border-t border-border flex items-center gap-4">
        <ClearAllButton planId={plan.id} onCleared={() => setAssignments(new Map())} />
        <DeletePlanButton planId={plan.id} />
      </div>

      {reviewEntry && (
        <AutoExamReviewModal
          planId={plan.id}
          milestoneId={reviewEntry.milestoneId}
          nodeTitle={reviewEntry.nodeTitle}
          onClose={() => setReviewEntry(null)}
          onApproved={() => {
            const nodeId = reviewEntry.nodeId
            startTransition(() => {
              setAssignments(prev => {
                const next = new Map(prev)
                const existing = next.get(nodeId)
                if (existing) next.set(nodeId, { ...existing, autoExamStatus: "assigned" })
                return next
              })
            })
          }}
          onRegenerated={(paperId) => {
            const nodeId = reviewEntry.nodeId
            startTransition(() => {
              setAssignments(prev => {
                const next = new Map(prev)
                const existing = next.get(nodeId)
                if (existing) next.set(nodeId, { ...existing, autoExamPaperId: paperId, autoExamStatus: "pending_review" })
                return next
              })
            })
          }}
        />
      )}
    </div>
  )
}

function ClearAllButton({ planId, onCleared }: { planId: string; onCleared: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing]     = useState(false)

  async function handleClear() {
    setClearing(true)
    await fetch(`/api/educator/pacing/${planId}/milestones`, { method: "DELETE" })
    setClearing(false)
    setConfirming(false)
    onCleared()
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        Clear all slots
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-destructive">Remove all scheduled slots? This cannot be undone.</p>
      <Button size="sm" variant="destructive" disabled={clearing} onClick={handleClear}>
        {clearing ? "Clearing…" : "Yes, clear"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
    </div>
  )
}

function DeletePlanButton({ planId }: { planId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/educator/pacing/${planId}`, { method: "DELETE" })
    window.location.href = "/exams/pacing"
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="size-3.5" /> Delete plan
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-destructive">This will permanently delete the plan and all schedules. Are you sure?</p>
      <Button size="sm" variant="destructive" disabled={deleting} onClick={handleDelete}>
        {deleting ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
    </div>
  )
}
