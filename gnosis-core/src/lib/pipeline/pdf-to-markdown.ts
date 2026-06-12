import { genAI, withRetry } from "@/lib/ai/gemini"

const PAGE_NUMBER_RE = /^\s*[-–]?\s*\d{1,4}\s*[-–]?\s*$|^\s*page\s+\d+(\s+of\s+\d+)?\s*$/gim
const SEPARATOR_RE = /^[\s*\-_=~]{3,}\s*$/gm
const MULTI_BLANK_RE = /\n{3,}/g
const TRAILING_SPACE_RE = /[ \t]+$/gm
const HEADING_RE = /^([A-Z][^a-z\n]{2,79})$/gm

// If extracted text is shorter than this the PDF is likely scanned — fall back to Gemini Vision
const MIN_TEXT_LENGTH = 200

function detectRepeatedLines(pages: string[], minFreq = 3): Set<string> {
  const counter = new Map<string, number>()
  for (const page of pages) {
    const seen = new Set<string>()
    for (const line of page.split("\n")) {
      const s = line.trim()
      if (s && !seen.has(s)) {
        counter.set(s, (counter.get(s) ?? 0) + 1)
        seen.add(s)
      }
    }
  }
  return new Set([...counter.entries()].filter(([, n]) => n >= minFreq).map(([l]) => l))
}

function cleanPage(text: string, repeated: Set<string>): string {
  return text
    .split("\n")
    .filter((line) => {
      const s = line.trim()
      if (!s) return true
      if (repeated.has(s)) return false
      if (PAGE_NUMBER_RE.test(s) || SEPARATOR_RE.test(s)) return false
      return true
    })
    .join("\n")
}

function promoteHeadings(text: string): string {
  return text.replace(HEADING_RE, (match) => `\n## ${match.trim()}`)
}

async function geminiOcr(buffer: Buffer, title: string, mimeType: string): Promise<string> {
  const b64 = buffer.toString("base64")
  const result = await withRetry(() =>
    genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: b64 } },
            { text: "Extract all text from this document exactly as written. Preserve headings and paragraph structure. Output plain text only — no commentary." },
          ],
        },
      ],
    })
  )
  return (result.text ?? "").trim()
}

export async function pdfToMarkdown(
  buffer: Buffer,
  title: string
): Promise<{ markdown: string; pageCount: number; tokenCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse") as (b: Buffer, opts?: object) => Promise<{ text: string; numpages: number }>

  let text = ""
  let pageCount = 0

  try {
    const data = await pdfParse(buffer)
    pageCount = data.numpages
    text = data.text.trim()
  } catch (parseErr) {
    console.warn(`[pipeline] pdf-parse threw: ${(parseErr as Error).message} — falling back to Gemini OCR`)
  }

  // Scanned PDF or parse failure — fall back to Gemini Vision
  if (text.length < MIN_TEXT_LENGTH) {
    console.log(`[pipeline] low text (${text.length} chars) — using Gemini Vision OCR`)
    text = await geminiOcr(buffer, title, "application/pdf")
  }

  const pages = text.split(/\f/).filter(Boolean)
  const repeated = detectRepeatedLines(pages.length >= 3 ? pages : [])
  const cleaned = pages
    .map((p: string) => cleanPage(p, repeated))
    .join("\n\n")

  let markdown = `# ${title}\n\n${cleaned}`
  markdown = markdown
    .replace(TRAILING_SPACE_RE, "")
    .replace(MULTI_BLANK_RE, "\n\n")
  markdown = promoteHeadings(markdown).trim()

  const tokenCount = Math.max(1, Math.floor(markdown.length / 4))
  return { markdown, pageCount, tokenCount }
}

export async function imageToMarkdown(
  buffer: Buffer,
  title: string,
  mimeType: string
): Promise<{ markdown: string; tokenCount: number }> {
  const raw = await geminiOcr(buffer, title, mimeType)
  const markdown = `# ${title}\n\n${raw}`
  const tokenCount = Math.max(1, Math.floor(markdown.length / 4))
  return { markdown, tokenCount }
}
