/**
 * Renders a mixed text+LaTeX string to HTML.
 * Segments wrapped in $$...$$ become display-mode math.
 * Segments wrapped in $...$ become inline math.
 * Everything else is HTML-escaped plain text.
 *
 * katex is passed as a parameter so this function is pure and testable
 * without a DOM environment.
 */
export function renderMixed(
  text: string,
  katex: { renderToString: (tex: string, opts: { displayMode: boolean; throwOnError: boolean }) => string }
): string {
  // Split on $$...$$ first (greedy-safe with [\s\S]), then $...$
  const parts = text.split(/((?:\$\$[\s\S]+?\$\$|\$[^$\n]+?\$))/g)

  return parts.map(part => {
    if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
      try {
        return katex.renderToString(part.slice(2, -2), { displayMode: true, throwOnError: false })
      } catch {
        return htmlEscape(part)
      }
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      try {
        return katex.renderToString(part.slice(1, -1), { displayMode: false, throwOnError: false })
      } catch {
        return htmlEscape(part)
      }
    }
    return htmlEscape(part)
  }).join("")
}

function htmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
