import { describe, it, expect } from "vitest"
import {
  equalWeights,
  deriveSelectedNodes,
  collectNodeSlices,
  normalizeWeights,
  distributeQuestions,
} from "./utils"
import type { NodeSlice } from "./utils"

// ── Test data helpers ─────────────────────────────────────────────────────────

function makeBook(id: string, title: string, blocks: Array<{ id: string; level: string; text: string }>) {
  return { id, title, blocks: blocks as any }
}

function node(id: string) { return { id } }

// ── equalWeights ──────────────────────────────────────────────────────────────

describe("equalWeights", () => {
  it("returns empty object for empty array", () => {
    expect(equalWeights([])).toEqual({})
  })

  it("gives 100% to a single node", () => {
    expect(equalWeights([node("a")])).toEqual({ a: 100 })
  })

  it("splits evenly for 2 nodes", () => {
    const w = equalWeights([node("a"), node("b")])
    expect(w.a).toBe(50)
    expect(w.b).toBe(50)
    expect(w.a + w.b).toBe(100)
  })

  it("splits evenly for 4 nodes", () => {
    const w = equalWeights([node("a"), node("b"), node("c"), node("d")])
    expect(Object.values(w).reduce((s, v) => s + v, 0)).toBe(100)
    expect(Object.values(w).every(v => v === 25)).toBe(true)
  })

  it("assigns remainder to last node for uneven split (3 nodes)", () => {
    const w = equalWeights([node("a"), node("b"), node("c")])
    // floor(100/3) = 33, remainder = 1 → last node gets 34
    expect(w.a).toBe(33)
    expect(w.b).toBe(33)
    expect(w.c).toBe(34)
    expect(w.a + w.b + w.c).toBe(100)
  })

  it("assigns remainder to last node for 7 nodes", () => {
    const nodes = ["a","b","c","d","e","f","g"].map(node)
    const w = equalWeights(nodes)
    const total = Object.values(w).reduce((s, v) => s + v, 0)
    expect(total).toBe(100)
    // floor(100/7) = 14, remainder = 2 → last node gets 16
    expect(w.g).toBe(16)
  })
})

// ── deriveSelectedNodes ───────────────────────────────────────────────────────

describe("deriveSelectedNodes", () => {
  it("returns empty array when nothing selected", () => {
    const book = makeBook("b1", "Physics", [
      { id: "c1", level: "chapter", text: "Chapter 1" },
      { id: "s1", level: "section", text: "Section 1" },
    ])
    expect(deriveSelectedNodes([book], new Set())).toEqual([])
  })

  it("returns chapter-level node when chapter has no sections", () => {
    const book = makeBook("b1", "History", [
      { id: "c1", level: "chapter", text: "World War 2" },
    ])
    const result = deriveSelectedNodes([book], new Set(["c1"]))
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ id: "c1", label: "World War 2", bookTitle: "History" })
    expect(result[0].chapterLabel).toBeUndefined()
  })

  it("returns section-level nodes when chapter has sections", () => {
    const book = makeBook("b1", "Maths", [
      { id: "c1", level: "chapter", text: "Algebra" },
      { id: "s1", level: "section", text: "Linear Equations" },
      { id: "s2", level: "section", text: "Quadratics" },
    ])
    const result = deriveSelectedNodes([book], new Set(["s1", "s2"]))
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: "s1", label: "Linear Equations", chapterLabel: "Algebra", bookTitle: "Maths" })
    expect(result[1]).toMatchObject({ id: "s2", label: "Quadratics", chapterLabel: "Algebra", bookTitle: "Maths" })
  })

  it("only returns selected sections, not all sections", () => {
    const book = makeBook("b1", "Maths", [
      { id: "c1", level: "chapter", text: "Algebra" },
      { id: "s1", level: "section", text: "Linear Equations" },
      { id: "s2", level: "section", text: "Quadratics" },
    ])
    const result = deriveSelectedNodes([book], new Set(["s1"]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("s1")
  })

  it("does not return a chapter node when chapter has sections (even if chapter id selected)", () => {
    const book = makeBook("b1", "Maths", [
      { id: "c1", level: "chapter", text: "Algebra" },
      { id: "s1", level: "section", text: "Linear Equations" },
    ])
    const result = deriveSelectedNodes([book], new Set(["c1"]))
    // c1 has sections so its ID shouldn't appear — sections are the leaf nodes
    expect(result.find(n => n.id === "c1")).toBeUndefined()
  })

  it("handles multiple books", () => {
    const book1 = makeBook("b1", "Physics", [
      { id: "c1", level: "chapter", text: "Mechanics" },
    ])
    const book2 = makeBook("b2", "Chemistry", [
      { id: "c2", level: "chapter", text: "Bonding" },
    ])
    const result = deriveSelectedNodes([book1, book2], new Set(["c1", "c2"]))
    expect(result).toHaveLength(2)
    expect(result[0].bookTitle).toBe("Physics")
    expect(result[1].bookTitle).toBe("Chemistry")
  })

  it("ignores details-level blocks", () => {
    const book = makeBook("b1", "Biology", [
      { id: "c1", level: "chapter", text: "Cells" },
      { id: "d1", level: "details", text: "Cell content paragraph" },
    ])
    const result = deriveSelectedNodes([book], new Set(["c1"]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("c1")
  })
})

// ── collectNodeSlices ─────────────────────────────────────────────────────────

describe("collectNodeSlices", () => {
  it("returns empty array when nothing selected", () => {
    const book = makeBook("b1", "Physics", [
      { id: "c1", level: "chapter", text: "Mechanics" },
    ])
    expect(collectNodeSlices([book], new Set())).toEqual([])
  })

  it("includes chapter text in slice text for a chapter-only node", () => {
    const book = makeBook("b1", "History", [
      { id: "c1", level: "chapter", text: "WW2" },
    ])
    const slices = collectNodeSlices([book], new Set(["c1"]))
    expect(slices).toHaveLength(1)
    expect(slices[0].id).toBe("c1")
    expect(slices[0].text).toContain("WW2")
    expect(slices[0].weight).toBe(0)
  })

  it("includes details text in chapter-only node", () => {
    const book = makeBook("b1", "History", [
      { id: "c1", level: "chapter", text: "WW2" },
      { id: "d1", level: "details", text: "The war started in 1939." },
    ])
    const slices = collectNodeSlices([book], new Set(["c1"]))
    expect(slices[0].text).toContain("The war started in 1939.")
  })

  it("includes chapter + section + details in section slice text", () => {
    const book = makeBook("b1", "Maths", [
      { id: "c1", level: "chapter", text: "Algebra" },
      { id: "s1", level: "section", text: "Linear Equations" },
      { id: "d1", level: "details", text: "An equation with degree 1." },
    ])
    const slices = collectNodeSlices([book], new Set(["s1"]))
    expect(slices[0].text).toContain("Algebra")
    expect(slices[0].text).toContain("Linear Equations")
    expect(slices[0].text).toContain("An equation with degree 1.")
  })

  it("separates details by section correctly", () => {
    const book = makeBook("b1", "Maths", [
      { id: "c1", level: "chapter", text: "Algebra" },
      { id: "s1", level: "section", text: "Linear" },
      { id: "d1", level: "details", text: "Linear content" },
      { id: "s2", level: "section", text: "Quadratic" },
      { id: "d2", level: "details", text: "Quadratic content" },
    ])
    const slices = collectNodeSlices([book], new Set(["s1", "s2"]))
    const s1 = slices.find(s => s.id === "s1")!
    const s2 = slices.find(s => s.id === "s2")!
    expect(s1.text).toContain("Linear content")
    expect(s1.text).not.toContain("Quadratic content")
    expect(s2.text).toContain("Quadratic content")
    expect(s2.text).not.toContain("Linear content")
  })

  it("only returns selected sections", () => {
    const book = makeBook("b1", "Maths", [
      { id: "c1", level: "chapter", text: "Algebra" },
      { id: "s1", level: "section", text: "Linear" },
      { id: "s2", level: "section", text: "Quadratic" },
    ])
    const slices = collectNodeSlices([book], new Set(["s1"]))
    expect(slices).toHaveLength(1)
    expect(slices[0].id).toBe("s1")
  })
})

// ── normalizeWeights ──────────────────────────────────────────────────────────

describe("normalizeWeights", () => {
  it("returns equal weights when all inputs are zero", () => {
    const result = normalizeWeights({ a: 0, b: 0 }, ["a", "b"])
    expect(result.a).toBe(50)
    expect(result.b).toBe(50)
  })

  it("normalizes already-correct weights unchanged", () => {
    const result = normalizeWeights({ a: 60, b: 40 }, ["a", "b"])
    expect(result.a).toBeCloseTo(60)
    expect(result.b).toBeCloseTo(40)
  })

  it("normalizes weights that sum to more than 100", () => {
    const result = normalizeWeights({ a: 80, b: 80 }, ["a", "b"])
    expect(result.a).toBeCloseTo(50)
    expect(result.b).toBeCloseTo(50)
    expect(result.a + result.b).toBeCloseTo(100)
  })

  it("normalizes weights that sum to less than 100", () => {
    const result = normalizeWeights({ a: 10, b: 30 }, ["a", "b"])
    expect(result.a).toBeCloseTo(25)
    expect(result.b).toBeCloseTo(75)
  })

  it("treats missing ids as 0 weight", () => {
    const result = normalizeWeights({ a: 100 }, ["a", "b"])
    expect(result.a).toBeCloseTo(100)
    expect(result.b).toBeCloseTo(0)
  })

  it("equal fallback for 3 nodes all zero", () => {
    const result = normalizeWeights({ a: 0, b: 0, c: 0 }, ["a", "b", "c"])
    expect(result.a).toBeCloseTo(100 / 3)
    expect(result.b).toBeCloseTo(100 / 3)
    expect(result.c).toBeCloseTo(100 / 3)
  })
})

// ── distributeQuestions ───────────────────────────────────────────────────────

function makeSlice(id: string, weight: number): NodeSlice {
  return { id, label: id, text: id, weight }
}

describe("distributeQuestions", () => {
  it("returns empty array for empty slices", () => {
    expect(distributeQuestions([], 10, 90)).toEqual([])
  })

  it("total easy + hard sums to requested total (single slice)", () => {
    const tasks = distributeQuestions([makeSlice("a", 100)], 10, 90)
    const total = tasks.reduce((s, t) => s + t.count, 0)
    expect(total).toBe(10)
  })

  it("easy count respects easy_pct=90", () => {
    const tasks = distributeQuestions([makeSlice("a", 100)], 10, 90)
    const easy = tasks.filter(t => t.difficulty === "easy").reduce((s, t) => s + t.count, 0)
    const hard = tasks.filter(t => t.difficulty === "hard").reduce((s, t) => s + t.count, 0)
    expect(easy).toBe(9)
    expect(hard).toBe(1)
  })

  it("100% easy produces no hard tasks", () => {
    const tasks = distributeQuestions([makeSlice("a", 100)], 5, 100)
    expect(tasks.filter(t => t.difficulty === "hard")).toHaveLength(0)
    expect(tasks.filter(t => t.difficulty === "easy")[0].count).toBe(5)
  })

  it("0% easy produces no easy tasks", () => {
    const tasks = distributeQuestions([makeSlice("a", 100)], 5, 0)
    expect(tasks.filter(t => t.difficulty === "easy")).toHaveLength(0)
    expect(tasks.filter(t => t.difficulty === "hard")[0].count).toBe(5)
  })

  it("distributes across two equal-weight slices", () => {
    const slices = [makeSlice("a", 50), makeSlice("b", 50)]
    const tasks = distributeQuestions(slices, 10, 100)
    const aCount = tasks.filter(t => t.nodeId === "a").reduce((s, t) => s + t.count, 0)
    const bCount = tasks.filter(t => t.nodeId === "b").reduce((s, t) => s + t.count, 0)
    expect(aCount + bCount).toBe(10)
    expect(aCount).toBe(5)
    expect(bCount).toBe(5)
  })

  it("last slice absorbs rounding remainder so total is exact", () => {
    // 3 slices equal weight, total=10 — rounding would miscount without the last-slice correction
    const slices = [makeSlice("a", 33.33), makeSlice("b", 33.33), makeSlice("c", 33.34)]
    const tasks = distributeQuestions(slices, 10, 90)
    const total = tasks.reduce((s, t) => s + t.count, 0)
    expect(total).toBe(10)
  })

  it("does not emit a task with count=0", () => {
    // single slice, 1 question, 0% easy → only 1 hard task
    const tasks = distributeQuestions([makeSlice("a", 100)], 1, 0)
    expect(tasks.every(t => t.count > 0)).toBe(true)
    expect(tasks).toHaveLength(1)
  })
})
