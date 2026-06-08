import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { headers } from "next/headers"

import { devOtpStore } from "@/lib/whatsapp-dev-store"

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const IS_DEV = process.env.NODE_ENV === "development" ||
  !process.env.BACKEND_API_URL ||
  (process.env.BACKEND_API_URL ?? "").includes("localhost")

export async function POST(request: Request) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? "unknown"
  const { allowed } = checkRateLimit(`wa-send:${ip}`, 5, 10 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait before retrying." }, { status: 429 })
  }

  const { phone }: { phone: string } = await request.json()
  if (!phone?.trim()) {
    return NextResponse.json({ error: "Phone number required." }, { status: 400 })
  }

  // Dev mode — skip external service, store OTP in memory
  if (IS_DEV) {
    const code = generateCode()
    devOtpStore.set(phone.trim(), { code, expires: Date.now() + 10 * 60 * 1000 })
    console.log(`[dev] WhatsApp OTP for ${phone}: ${code}`)
    return NextResponse.json({ success: true, dev_otp: code })
  }

  // Production — forward to backend with timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${process.env.BACKEND_API_URL}/auth/whatsapp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify({ phone_number: phone.trim() }),
      signal: controller.signal,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: "WhatsApp service unavailable. Please try again later." }, { status: 503 })
  } finally {
    clearTimeout(timeout)
  }
}

