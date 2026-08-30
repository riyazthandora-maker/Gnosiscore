import type { FlatBlock } from "@/types/book"

// ── Weightage (Step 2) ────────────────────────────────────────────────────────

export interface SelectedNode {
  id: string
  label: string
  chapterLabel?: string
  bookTitle: string
}

export function deriveSelectedNodes(
  books: Array<{ id: string; title: string; blocks: FlatBlock[] }>,
  selectedNodeIds: Set<string>
): SelectedNode[] {
  const nodes: SelectedNode[] = []
  for (const book of books) {
    const chapters: Array<{ id: string; text: string; sections: Array<{ id: string; text: string }> }> = []
    let cur: (typeof chapters)[0] | null = null
    for (const b of book.blocks) {
      if (b.level === "chapter") { cur = { id: b.id, text: b.text, sections: [] }; chapters.push(cur) }
      else if (b.level === "section" && cur) cur.sections.push({ id: b.id, text: b.text })
    }
    for (const ch of chapters) {
      if (ch.sections.length === 0) {
        if (selectedNodeIds.has(ch.id)) nodes.push({ id: ch.id, label: ch.text, bookTitle: book.title })
      } else {
        for (const s of ch.sections) {
          if (selectedNodeIds.has(s.id)) nodes.push({ id: s.id, label: s.text, chapterLabel: ch.text, bookTitle: book.title })
        }
      }
    }
  }
  return nodes
}

export function equalWeights(nodes: Array<{ id: string }>): Record<string, number> {
  if (nodes.length === 0) return {}
  const base = Math.floor(100 / nodes.length)
  const remainder = 100 - base * nodes.length
  return Object.fromEntries(nodes.map((n, i) => [n.id, i === nodes.length - 1 ? base + remainder : base]))
}

// ── Generation (API route) ────────────────────────────────────────────────────

export interface NodeSlice {
  id: string
  label: string
  text: string
  weight: number
}

export function collectNodeSlices(
  books: Array<{ id: string; title: string; blocks: FlatBlock[] }>,
  selectedIds: Set<string>
): NodeSlice[] {
  const slices: NodeSlice[] = []

  for (const book of books) {
    // First pass: build chapter/section hierarchy
    const chapters: Array<{
      id: string
      text: string
      sections: Array<{ id: string; text: string }>
    }> = []
    let cur: (typeof chapters)[0] | null = null
    for (const b of book.blocks) {
      if (b.level === "chapter") {
        cur = { id: b.id, text: b.text, sections: [] }
        chapters.push(cur)
      } else if (b.level === "section" && cur) {
        cur.sections.push({ id: b.id, text: b.text })
      }
    }

    // Second pass: collect details text per section/chapter
    const detailsByNode: Record<string, string[]> = {}
    let curChapterId: string | null = null
    let curSectionId: string | null = null
    for (const b of book.blocks) {
      if (b.level === "chapter") { curChapterId = b.id; curSectionId = null }
      else if (b.level === "section") { curSectionId = b.id }
      else if (b.level === "details") {
        const key = curSectionId ?? curChapterId
        if (key) {
          if (!detailsByNode[key]) detailsByNode[key] = []
          detailsByNode[key].push(b.text)
        }
      }
    }

    for (const ch of chapters) {
      if (ch.sections.length === 0) {
        if (selectedIds.has(ch.id)) {
          const details = detailsByNode[ch.id] ?? []
          slices.push({ id: ch.id, label: ch.text, text: [ch.text, ...details].join("\n\n"), weight: 0 })
        }
      } else {
        for (const s of ch.sections) {
          if (selectedIds.has(s.id)) {
            const details = detailsByNode[s.id] ?? []
            slices.push({ id: s.id, label: s.text, text: [ch.text, s.text, ...details].join("\n\n"), weight: 0 })
          }
        }
      }
    }
  }

  return slices
}

export function normalizeWeights(raw: Record<string, number>, ids: string[]): Record<string, number> {
  const total = ids.reduce((sum, id) => sum + (raw[id] ?? 0), 0)
  if (total === 0) {
    const eq = 100 / ids.length
    return Object.fromEntries(ids.map(id => [id, eq]))
  }
  return Object.fromEntries(ids.map(id => [id, ((raw[id] ?? 0) / total) * 100]))
}

export interface QuestionTask {
  nodeId: string
  difficulty: "easy" | "hard"
  count: number
}

export function distributeQuestions(
  slices: NodeSlice[],
  total: number,
  easy_pct: number
): QuestionTask[] {
  const easyTotal = Math.round(total * easy_pct / 100)
  const hardTotal = total - easyTotal
  const tasks: QuestionTask[] = []
  let assignedEasy = 0
  let assignedHard = 0

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i]
    const isLast = i === slices.length - 1
    const easyCount = isLast ? easyTotal - assignedEasy : Math.round(easyTotal * s.weight / 100)
    const hardCount = isLast ? hardTotal - assignedHard : Math.round(hardTotal * s.weight / 100)
    assignedEasy += easyCount
    assignedHard += hardCount
    if (easyCount > 0) tasks.push({ nodeId: s.id, difficulty: "easy", count: easyCount })
    if (hardCount > 0) tasks.push({ nodeId: s.id, difficulty: "hard", count: hardCount })
  }

  return tasks
}
