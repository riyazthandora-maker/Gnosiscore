import { GoogleGenAI } from "@google/genai"

export const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

export const QUIZ_MODEL       = "gemini-2.5-flash"
export const DIAGNOSTIC_MODEL = "gemini-2.5-flash"

export interface GeminiResult {
  text: string
  totalTokenCount: number
}

/**
 * Call Gemini via raw fetch so we can sanitize the HTTP response body
 * before JSON.parse. The SDK's internal response.json() crashes on
 * "bad control character" when Gemini embeds literal newlines/tabs in
 * math-heavy string values and the API server doesn't escape them.
 */
export async function callGemini(opts: {
  model: string
  systemInstruction: string
  contents: string
  maxOutputTokens: number
  temperature: number
}): Promise<GeminiResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: opts.contents }] }],
      systemInstruction: { parts: [{ text: opts.systemInstruction }] },
      generationConfig: {
        maxOutputTokens: opts.maxOutputTokens,
        temperature: opts.temperature,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  // Read as raw text so we control JSON.parse — never use res.json()
  const rawBody = await res.text()

  // Strip literal control chars before parsing: outside strings they become
  // whitespace (valid); inside strings they become spaces (content loss is
  // acceptable — the alternative is an uncatchable SDK crash).
  const sanitized = rawBody.replace(/[\x00-\x1F\x7F]/g, (c) =>
    c === "\n" || c === "\r" || c === "\t" ? " " : ""
  )

  const data = JSON.parse(sanitized) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    usageMetadata?: { totalTokenCount?: number }
    error?: { code?: number; message?: string; status?: string }
  }

  if (data.error) {
    const code = data.error.code ?? res.status
    const msg  = data.error.message ?? res.statusText
    throw new Error(`${code} ${msg}`)   // "429 ..." triggers withRetry backoff
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")

  return { text, totalTokenCount: data.usageMetadata?.totalTokenCount ?? 0 }
}

/**
 * Retry a Gemini call with exponential backoff on 429 / quota errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const message = err instanceof Error ? err.message : String(err)
      const isQuota = message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")
      if (!isQuota || attempt === maxAttempts) throw err
      const delay = Math.pow(2, attempt) * 1000
      console.warn(`[gemini] rate limit hit, retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
