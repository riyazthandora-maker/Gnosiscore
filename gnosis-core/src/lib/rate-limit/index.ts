interface Bucket {
  count: number
  resetAt: number
}

// In-memory store — resets on cold start. Replace with Upstash Redis for multi-instance deployments.
const store = new Map<string, Bucket>()

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count++
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

// Convenience wrappers for specific limits
export const LIMITS = {
  quizGenerate: { limit: 10, windowMs: 60 * 60 * 1000 },  // 10 tests/hour per user
  diagnose:     { limit: 5,  windowMs: 60 * 60 * 1000 },  // 5 diagnostics/hour
  invitations:  { limit: 20, windowMs: 60 * 60 * 1000 },  // 20 invites/hour
}
