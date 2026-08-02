import katex from "katex"

type Segment =
  | { type: "text"; content: string }
  | { type: "inline" | "block"; content: string }

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = []
  // Match $$...$$ (block) before $...$ (inline) to avoid partial matches
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", content: text.slice(last, match.index) })
    }
    if (match[1] !== undefined) {
      segments.push({ type: "block", content: match[1] })
    } else {
      segments.push({ type: "inline", content: match[2] })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    segments.push({ type: "text", content: text.slice(last) })
  }
  return segments
}

function renderMath(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
    })
  } catch {
    return latex
  }
}

export function MathText({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  if (!children) return null

  const segments = parseSegments(children)

  // No math delimiters — plain text, no extra DOM nodes
  if (segments.length === 1 && segments[0].type === "text") {
    return <span className={className}>{children}</span>
  }

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.content}</span>
        const html = renderMath(seg.content, seg.type === "block")
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </span>
  )
}
