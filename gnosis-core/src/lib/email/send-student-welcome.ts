import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.org"
const fromDomain = () => process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

export async function sendStudentWelcomeEmail(opts: {
  to: string
  fullName: string
  grade: string
  magicLink: string
}): Promise<void> {
  const { to, fullName, grade, magicLink } = opts

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Your 5-minute talent assessment is ready</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8);">Discover your inner talent</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;font-weight:600;">Hi ${fullName || "there"} 👋</p>
            <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
              Your GnosisCore account is set up for <strong>${grade}</strong>. We've prepared a quick <strong>5-minute talent assessment</strong> to help discover where your natural strengths lie.
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
              After the assessment you'll see a personalised talent report mapping your abilities across Arts, Language and Maths.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${magicLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
                  Start My Assessment →
                </a>
              </td></tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;color:#aaa;text-align:center;">
              This link expires in 24 hours · Do not share it with others
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">
              Sent via <a href="${appUrl()}" style="color:#7c3aed;text-decoration:none;">GnosisCore</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain()}>`,
    to: [to],
    subject: "Your 5-minute talent assessment is ready",
    html,
  })

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[send-student-welcome] Resend blocked. Magic link:", magicLink)
      return
    }
    throw new Error(`Failed to send student welcome email: ${error.message}`)
  }
}
