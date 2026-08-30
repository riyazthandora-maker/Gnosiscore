import { describe, it, expect, vi } from "vitest"
import { renderMixed } from "./katex-utils"

// Mock katex: returns a predictable tag so we can assert which mode was used
function mockKatex(tex: string, opts: { displayMode: boolean }): string {
  return opts.displayMode ? `<DISPLAY>${tex}</DISPLAY>` : `<INLINE>${tex}</INLINE>`
}

const katex = { renderToString: mockKatex }

// ── Plain text ────────────────────────────────────────────────────────────────

describe("plain text (no math)", () => {
  it("returns plain text unchanged", () => {
    expect(renderMixed("Hello world", katex)).toBe("Hello world")
  })

  it("returns empty string unchanged", () => {
    expect(renderMixed("", katex)).toBe("")
  })

  it("HTML-escapes ampersands", () => {
    expect(renderMixed("A & B", katex)).toBe("A &amp; B")
  })

  it("HTML-escapes less-than", () => {
    expect(renderMixed("a < b", katex)).toBe("a &lt; b")
  })

  it("HTML-escapes greater-than", () => {
    expect(renderMixed("a > b", katex)).toBe("a &gt; b")
  })

  it("HTML-escapes all special chars in one string", () => {
    expect(renderMixed("<b>bold & bright</b>", katex)).toBe("&lt;b&gt;bold &amp; bright&lt;/b&gt;")
  })
})

// ── Inline math ($...$) ───────────────────────────────────────────────────────

describe("inline math ($...$)", () => {
  it("renders inline math with displayMode: false", () => {
    expect(renderMixed("$x^2$", katex)).toBe("<INLINE>x^2</INLINE>")
  })

  it("renders inline math with surrounding text", () => {
    const result = renderMixed("The value is $x + 1$ units", katex)
    expect(result).toBe("The value is <INLINE>x + 1</INLINE> units")
  })

  it("renders multiple inline math segments", () => {
    const result = renderMixed("$a$ and $b$", katex)
    expect(result).toBe("<INLINE>a</INLINE> and <INLINE>b</INLINE>")
  })

  it("renders LaTeX fractions: $\\frac{1}{2}$", () => {
    const result = renderMixed("$\\frac{1}{2}$", katex)
    expect(result).toBe("<INLINE>\\frac{1}{2}</INLINE>")
  })

  it("renders Greek letters: $\\alpha + \\beta$", () => {
    const result = renderMixed("Find $\\alpha + \\beta$", katex)
    expect(result).toBe("Find <INLINE>\\alpha + \\beta</INLINE>")
  })

  it("renders AI-generated doubled backslash LaTeX: $\\\\leq$", () => {
    // AI output doubles backslashes in JSON strings: \\leq in source = \leq in parsed string
    const result = renderMixed("$\\\\leq$", katex)
    expect(result).toBe("<INLINE>\\\\leq</INLINE>")
  })

  it("does not treat a lone $ as math", () => {
    // Single $ with no closing pair — treated as plain text
    const result = renderMixed("Price: $100", katex)
    expect(result).not.toContain("<INLINE>")
    expect(result).toContain("$100")
  })

  it("does not treat $$-delimited text as inline math", () => {
    const result = renderMixed("$$x$$", katex)
    expect(result).not.toContain("<INLINE>")
    expect(result).toContain("<DISPLAY>")
  })
})

// ── Display (block) math ($$...$$) ───────────────────────────────────────────

describe("display math ($$...$$)", () => {
  it("renders display math with displayMode: true", () => {
    expect(renderMixed("$$x^2$$", katex)).toBe("<DISPLAY>x^2</DISPLAY>")
  })

  it("renders display math with surrounding text", () => {
    const result = renderMixed("The formula:$$E=mc^2$$end", katex)
    expect(result).toBe("The formula:<DISPLAY>E=mc^2</DISPLAY>end")
  })

  it("renders multiline display math (\\n inside $$)", () => {
    const result = renderMixed("$$\\int_0^1\nx\\,dx$$", katex)
    expect(result).toBe("<DISPLAY>\\int_0^1\nx\\,dx</DISPLAY>")
  })

  it("renders integral: $$\\\\int_0^1 f(x)\\\\,dx$$", () => {
    const result = renderMixed("$$\\\\int_0^1 f(x)\\\\,dx$$", katex)
    expect(result).toBe("<DISPLAY>\\\\int_0^1 f(x)\\\\,dx</DISPLAY>")
  })

  it("renders multiple display math segments", () => {
    const result = renderMixed("$$a$$text$$b$$", katex)
    expect(result).toBe("<DISPLAY>a</DISPLAY>text<DISPLAY>b</DISPLAY>")
  })
})

// ── Mixed inline and display math ─────────────────────────────────────────────

describe("mixed math and text", () => {
  it("handles inline then display", () => {
    const result = renderMixed("Use $a$ or $$b$$.", katex)
    expect(result).toBe("Use <INLINE>a</INLINE> or <DISPLAY>b</DISPLAY>.")
  })

  it("handles display then inline", () => {
    const result = renderMixed("$$\\sum$$where $n > 0$", katex)
    expect(result).toBe("<DISPLAY>\\sum</DISPLAY>where <INLINE>n > 0</INLINE>")
  })

  it("interleaves plain text and multiple math segments", () => {
    const result = renderMixed("Let $x=1$, then $$y=x^2$$ so $y=1$.", katex)
    expect(result).toBe("Let <INLINE>x=1</INLINE>, then <DISPLAY>y=x^2</DISPLAY> so <INLINE>y=1</INLINE>.")
  })

  it("HTML-escapes plain-text segments between math", () => {
    const result = renderMixed("$a$ & $b$", katex)
    expect(result).toBe("<INLINE>a</INLINE> &amp; <INLINE>b</INLINE>")
  })
})

// ── Real-world exam question strings ─────────────────────────────────────────

describe("real-world exam question content", () => {
  it("renders a quadratic question body", () => {
    const body = "Which value of $x$ satisfies $x^2 - 5x + 6 = 0$?"
    const result = renderMixed(body, katex)
    expect(result).toContain("<INLINE>x</INLINE>")
    expect(result).toContain("<INLINE>x^2 - 5x + 6 = 0</INLINE>")
    expect(result).toContain("Which value of")
    expect(result).toContain("satisfies")
  })

  it("renders a fraction-heavy option", () => {
    const option = "$\\frac{3}{4} + \\frac{1}{4}$"
    const result = renderMixed(option, katex)
    expect(result).toBe("<INLINE>\\frac{3}{4} + \\frac{1}{4}</INLINE>")
  })

  it("renders a display-mode integral in an explanation", () => {
    const explanation = "The area under the curve is $$\\int_a^b f(x)\\,dx$$."
    const result = renderMixed(explanation, katex)
    expect(result).toContain("<DISPLAY>\\int_a^b f(x)\\,dx</DISPLAY>")
    expect(result).toContain("The area under the curve is")
  })

  it("renders a matrix question with doubled backslashes (AI JSON output)", () => {
    // AI produces \\begin in JSON → single \begin in parsed string → LaTeX
    const body = "Find the determinant: $$\\\\begin{vmatrix} a & b \\\\\\\\ c & d \\\\end{vmatrix}$$"
    const result = renderMixed(body, katex)
    expect(result).toContain("<DISPLAY>")
    expect(result).toContain("begin{vmatrix}")
  })

  it("renders comparison operators: $a \\\\leq b$", () => {
    const result = renderMixed("If $a \\\\leq b$ then", katex)
    expect(result).toContain("<INLINE>a \\\\leq b</INLINE>")
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe("katex error handling", () => {
  it("falls back to HTML-escaped source when katex throws on inline math", () => {
    const throwingKatex = {
      renderToString: () => { throw new Error("bad LaTeX") }
    }
    const result = renderMixed("$\\invalid$", throwingKatex)
    // Should fall back to escaped original text, not crash
    expect(result).toContain("$")
    expect(result).not.toContain("<INLINE>")
  })

  it("falls back to HTML-escaped source when katex throws on display math", () => {
    const throwingKatex = {
      renderToString: () => { throw new Error("bad LaTeX") }
    }
    const result = renderMixed("$$\\invalid$$", throwingKatex)
    expect(result).toContain("$")
    expect(result).not.toContain("<DISPLAY>")
  })

  it("continues rendering remaining segments after a failure", () => {
    let callCount = 0
    const partialKatex = {
      renderToString: (tex: string, opts: { displayMode: boolean }) => {
        callCount++
        if (callCount === 1) throw new Error("first fails")
        return opts.displayMode ? `<DISPLAY>${tex}</DISPLAY>` : `<INLINE>${tex}</INLINE>`
      }
    }
    const result = renderMixed("$bad$ and $good$", partialKatex)
    expect(result).toContain("<INLINE>good</INLINE>")
  })
})
