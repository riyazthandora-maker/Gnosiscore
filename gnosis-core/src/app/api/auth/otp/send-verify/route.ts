import { Resend } from "resend"
import { NextResponse } from "next/server"
import { signOtpToken } from "@/lib/otp-token"
import { checkRateLimit } from "@/lib/rate-limit"
import { headers } from "next/headers"

const resend = new Resend(process.env.RESEND_API_KEY!)
const fromDomain = () => process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

export async function POST(request: Request) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? "unknown"
  const { allowed } = checkRateLimit(`send-verify:${ip}`, 5, 10 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 })

  const { email } = await request.json() as { email: string }
  if (!email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 })

  const normalised = email.trim().toLowerCase()
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const token = signOtpToken(normalised, otp)

  const { error: emailErr } = await resend.emails.send({
    from: `GnosisCore <${fromDomain()}>`,
    to: [normalised],
    subject: `${otp} — verify your GnosisCore email`,
    html: buildVerifyHtml(otp),
  })

  if (emailErr) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[send-verify] DEV — EMAIL VERIFICATION CODE for ${normalised}: \x1b[1;33m${otp}\x1b[0m\n`)
      return NextResponse.json({ token })
    }
    console.error("[send-verify] Resend failed:", emailErr)
    return NextResponse.json({ error: "Failed to send verification code." }, { status: 500 })
  }

  return NextResponse.json({ token })
}

function buildVerifyHtml(otp: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.org"
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Verify your email — GnosisCore</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8);">Verify your email address</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:15px;color:#555;">Your verification code is:</p>
            <p style="margin:0 0 20px;font-size:44px;font-weight:700;letter-spacing:12px;color:#1a1a2e;font-family:'Courier New',monospace;">${otp}</p>
            <p style="margin:0;font-size:13px;color:#aaa;">Expires in 10 minutes · Do not share this code</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">
              Sent via <a href="${appUrl}" style="color:#7c3aed;text-decoration:none;">GnosisCore</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
