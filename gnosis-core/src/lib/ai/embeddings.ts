import { genAI, withRetry } from "@/lib/ai/gemini"
import type { SupabaseClient } from "@supabase/supabase-js"

const CHUNK_CHARS = 2000   // ~500 tokens
const OVERLAP_CHARS = 200  // ~50 tokens
const EMBED_BATCH = 20     // chunks per Google embeddings batch (free-tier safe)

/** Split markdown into overlapping chunks at paragraph boundaries. */
export function chunkMarkdown(markdown: string): string[] {
  const paragraphs = markdown.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim())
      const overlap = current.slice(-OVERLAP_CHARS).trim()
      current = overlap ? overlap + "\n\n" + para : para
    } else {
      current = current ? current + "\n\n" + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())

  // If a single paragraph exceeds CHUNK_CHARS, split it by sentence
  const result: string[] = []
  for (const chunk of chunks) {
    if (chunk.length <= CHUNK_CHARS) {
      result.push(chunk)
      continue
    }
    const sentences = chunk.match(/[^.!?]+[.!?]+\s*/g) ?? [chunk]
    let sub = ""
    for (const sent of sentences) {
      if (sub.length + sent.length > CHUNK_CHARS && sub.length > 0) {
        result.push(sub.trim())
        sub = sub.slice(-OVERLAP_CHARS).trim() + " " + sent
      } else {
        sub += sent
      }
    }
    if (sub.trim()) result.push(sub.trim())
  }

  return result.filter((c) => c.length > 0)
}

/** Embed chunks in batches and insert into document_chunks. Returns chunk count. */
export async function embedAndStore(
  documentId: string,
  chunks: string[],
  supabase: SupabaseClient
): Promise<number> {
  if (chunks.length === 0) return 0

  let insertedCount = 0

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i]

    const result = await withRetry(() =>
      genAI.models.embedContent({
        model: "gemini-embedding-001",
        contents: content,
        config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 },
      })
    )

    const values = result.embeddings?.[0]?.values
    if (!values || values.length === 0) {
      throw new Error(`Embedding API returned empty values for chunk ${i}.`)
    }

    const { error } = await supabase.from("document_chunks").insert({
      document_id: documentId,
      chunk_index: i,
      content,
      embedding: `[${values.join(",")}]`,
      token_count: Math.ceil(content.length / 4),
    })
    if (error) throw new Error(`Failed to store chunk ${i}: ${error.message}`)

    insertedCount++
  }

  return insertedCount
}
