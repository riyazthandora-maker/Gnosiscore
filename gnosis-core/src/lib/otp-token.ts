import crypto from "crypto"

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "gnosis-otp-fallback-secret"

export function signOtpToken(email: string, otp: string): string {
  const window = Math.floor(Date.now() / 600_000)
  return crypto
    .createHmac("sha256", secret())
    .update(`${email}:${otp}:${window}`)
    .digest("hex")
}

export function verifyOtpToken(email: string, otp: string, token: string): boolean {
  if (!token || token.length !== 64) return false
  const window = Math.floor(Date.now() / 600_000)
  for (const w of [window, window - 1]) {
    const expected = crypto
      .createHmac("sha256", secret())
      .update(`${email}:${otp}:${w}`)
      .digest("hex")
    try {
      if (crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"))) return true
    } catch { /* length mismatch — not equal */ }
  }
  return false
}
