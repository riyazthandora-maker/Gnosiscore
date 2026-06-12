/**
 * Process a stuck document using Gemini Vision (handles scanned PDFs).
 * Usage: node supabase/process-doc.mjs <document-id>
 */
import { createClient } from "@supabase/supabase-js"
import { createRequire } from "module"
import { GoogleGenAI } from "@google/genai"

const req = createRequire(import.meta.url)
const pdfParse = req("pdf-parse")

const SUPABASE_URL = "https://yjusiwggbufigtewqdcr.supabase.co"
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const GEMINI_KEY   = process.env.GOOGLE_AI_API_KEY || ""
const MIN_TEXT     = 200

const docId = process.argv[2]
if (!docId) { console.error("Usage: node process-doc.mjs <document-id>"); process.exit(1) }
if (!SERVICE_KEY || !GEMINI_KEY) { console.error("Missing env vars: SUPABASE_SERVICE_ROLE_KEY, GOOGLE_AI_API_KEY"); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY })

const { data: doc } = await supabase.from("documents").select("*").eq("id", docId).single()
if (!doc) { console.error("Document not found"); process.exit(1) }

console.log(`Processing: "${doc.title}" (${(doc.file_size_bytes / 1024).toFixed(0)} KB)`)

const { data: fileData } = await supabase.storage.from("documents").download(doc.original_path)
const buffer = Buffer.from(await fileData.arrayBuffer())

let text = ""
let pageCount = 1

// Try pdf-parse first
try {
  const data = await pdfParse(buffer)
  text = data.text.trim()
  pageCount = data.numpages
  console.log(`pdf-parse extracted ${text.length} chars from ${pageCount} pages`)
} catch (e) {
  console.log("pdf-parse failed, using Gemini Vision directly")
}

// Fall back to Gemini Vision for scanned PDFs
if (text.length < MIN_TEXT) {
  console.log("Scanned PDF detected — using Gemini Vision OCR...")
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } },
          { text: "Extract all text from this document. Preserve headings and paragraphs. Output plain text only." },
        ],
      },
    ],
  })
  text = (result.text ?? "").trim()
  console.log(`Gemini Vision extracted ${text.length} chars`)
}

let markdown = `# ${doc.title}\n\n${text}`
  .replace(/^\s*\d{1,4}\s*$/gm, "")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/[ \t]+$/gm, "")
  .trim()

const tokenCount = Math.floor(markdown.length / 4)
console.log(`Final: ${pageCount} pages, ~${tokenCount} tokens`)

const mdPath = doc.original_path.replace(/\.[^.]+$/, ".md")
await supabase.storage.from("documents").upload(
  mdPath,
  Buffer.from(markdown, "utf8"),
  { upsert: true, contentType: "text/markdown" }
)

await supabase.from("documents").update({
  markdown_path: mdPath,
  token_count: tokenCount,
  page_count: pageCount,
  status: "ready",
}).eq("id", docId)

console.log(`✓ Done — document is now READY`)
