import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendStudentInviteOptions {
  studentEmail: string
  studentName: string
  teacherName: string
  inviteUrl: string
  expiresAt: string
}

function buildHtml(opts: SendStudentInviteOptions): string {
  const { studentName, teacherName, inviteUrl, expiresAt } = opts

  const expiryDate = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(expiresAt))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been added to a class — GnosisCore</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.8);">AI-Powered Practice Tests</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Hi ${studentName},</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              <strong style="color:#1a1a2e;">${teacherName}</strong> has added you to their class on GnosisCore.
              Create your free account to access practice tests and assignments.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center">
                <a href="${inviteUrl}"
                   style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  Join Class →
                </a>
              </td></tr>
            </table>

            <p style="margin:0 0 6px;font-size:12px;color:#aaa;text-align:center;">
              Or copy this link: <a href="${inviteUrl}" style="color:#7c3aed;word-break:break-all;">${inviteUrl}</a>
            </p>
            <p style="margin:0;font-size:12px;color:#ccc;text-align:center;">This invite expires ${expiryDate}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">
              Sent via <a href="https://gnosiscore.ai" style="color:#7c3aed;text-decoration:none;">GnosisCore</a> · AI-powered practice tests
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendStudentInviteEmail(opts: SendStudentInviteOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.studentEmail],
    subject: `${opts.teacherName} added you to their class on GnosisCore`,
    html: buildHtml(opts),
  })

  if (error) {
    throw new Error(`Failed to send student invite email: ${error.message}`)
  }
}
