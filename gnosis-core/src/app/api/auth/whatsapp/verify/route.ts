import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { headers } from "next/headers"
import { devOtpStore } from "@/lib/whatsapp-dev-store"

const IS_DEV = process.env.NODE_ENV === "development" ||
  !process.env.BACKEND_API_URL ||
  (process.env.BACKEND_API_URL ?? "").includes("localhost")

export async function POST(request: Request) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? "unknown"
  const { allowed } = checkRateLimit(`wa-verify:${ip}`, 10, 10 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 })
  }

  const { phone, code }: { phone: string; code: string } = await request.json()
  if (!phone?.trim() || !code?.trim()) {
    return NextResponse.json({ error: "Phone number and code required." }, { status: 400 })
  }

  // Dev mode — verify against in-memory store
  if (IS_DEV) {
    const entry = devOtpStore.get(phone.trim())
    if (!entry) {
      return NextResponse.json({ error: "No OTP found. Please request a new code.", verified: false }, { status: 400 })
    }
    if (Date.now() > entry.expires) {
      devOtpStore.delete(phone.trim())
      return NextResponse.json({ error: "Code expired. Please request a new one.", verified: false }, { status: 400 })
    }
    if (entry.code !== code.trim()) {
      return NextResponse.json({ error: "Invalid code.", verified: false }, { status: 400 })
    }
    devOtpStore.delete(phone.trim())
    return NextResponse.json({ verified: true })
  }

  // Production — forward to backend with timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${process.env.BACKEND_API_URL}/auth/whatsapp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify({ phone_number: phone.trim(), code: code.trim() }),
      signal: controller.signal,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: "WhatsApp service unavailable.", verified: false }, { status: 503 })
  } finally {
    clearTimeout(timeout)
  }
}
