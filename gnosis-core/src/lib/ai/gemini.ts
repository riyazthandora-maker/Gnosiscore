import { GoogleGenAI } from "@google/genai"

export const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

export const QUIZ_MODEL       = "gemini-2.5-flash"
export const DIAGNOSTIC_MODEL = "gemini-2.5-flash"

/**
 * Retry a Gemini call with exponential backoff on 429 / quota errors.
 * Free tier: 30 RPM for flash-lite, so bursts are handled by waiting.
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
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000
      console.warn(`[gemini] rate limit hit, retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
