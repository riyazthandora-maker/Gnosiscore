import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"
import { NextResponse } from "next/server"

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string }

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 })
  }

  const normalised = email.trim().toLowerCase()
  const adminDb = createAdminClient()

  // Verify the user exists — silently succeed if not (prevent enumeration)
  const { data: profile } = await adminDb
    .from("users")
    .select("full_name")
    .eq("email", normalised)
    .single()

  if (!profile) {
    return NextResponse.json({ ok: true })
  }

  // Generate OTP in Supabase without triggering their (broken) SMTP
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const { data, error } = await adminDb.auth.admin.generateLink({
    type: "magiclink",
    email: normalised,
    options: { redirectTo: `${appUrl}/auth/callback` },
  })

  if (error || !data?.properties?.email_otp) {
    console.error("[otp/send] generateLink failed:", error)
    return NextResponse.json({ error: "Failed to generate login code." }, { status: 500 })
  }

  const otp = data.properties.email_otp
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

  const { error: emailErr } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [normalised],
    subject: `${otp} — your GnosisCore login code`,
    html: buildOtpHtml(otp, profile.full_name),
  })

  if (emailErr) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[otp/send] DEV MODE — email blocked by Resend (no verified domain)`)
      console.log(`[otp/send] LOGIN CODE for ${normalised}: \x1b[1;33m${otp}\x1b[0m\n`)
      return NextResponse.json({ ok: true })
    }
    // Resend failed (likely no verified domain) — fall back to Supabase's own email delivery
    console.warn("[otp/send] Resend failed, falling back to Supabase OTP:", emailErr)
    const supabase = await createClient()
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: normalised,
      options: { shouldCreateUser: false },
    })
    if (otpErr) {
      console.error("[otp/send] Supabase OTP fallback also failed:", otpErr)
      return NextResponse.json({ error: "Failed to send login code." }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

function buildOtpHtml(otp: string, name: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Your login code — GnosisCore</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8);">AI-Powered Practice Tests</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <p style="margin:0 0 20px;font-size:15px;color:#555;">Hi ${name || "there"}, here is your login code:</p>
            <p style="margin:0 0 20px;font-size:44px;font-weight:700;letter-spacing:12px;color:#1a1a2e;font-family:'Courier New',monospace;">${otp}</p>
            <p style="margin:0;font-size:13px;color:#aaa;">Expires in 10 minutes · Do not share this code</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">
              Sent via <a href="${appUrl}" style="color:#7c3aed;text-decoration:none;">GnosisCore</a> · AI-powered practice tests
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
