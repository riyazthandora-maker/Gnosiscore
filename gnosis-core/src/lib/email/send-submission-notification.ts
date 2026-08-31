import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendSubmissionNotificationOptions {
  teacherEmail: string
  teacherName: string
  studentName: string
  examTitle: string
  score: number
  maxScore: number
  submittedAt: string
}

function buildHtml(opts: SendSubmissionNotificationOptions): string {
  const { teacherName, studentName, examTitle, score, maxScore, submittedAt } = opts
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(submittedAt))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Test Submitted — GnosisCore</title>
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
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Hi ${teacherName},</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              <strong style="color:#1a1a2e;">${studentName}</strong> has submitted
              <strong style="color:#7c3aed;">${examTitle}</strong>.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border-radius:12px;padding:20px;margin-bottom:24px;">
              <tr>
                <td style="padding:8px 16px;font-size:14px;color:#555;">Score</td>
                <td style="padding:8px 16px;font-size:14px;font-weight:700;color:#1a1a2e;text-align:right;">${score} / ${maxScore} (${pct}%)</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;font-size:14px;color:#555;">Submitted at</td>
                <td style="padding:8px 16px;font-size:14px;color:#1a1a2e;text-align:right;">${date}</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">
              Sent via <a href="https://gnosiscore.ai" style="color:#7c3aed;text-decoration:none;">GnosisCore</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendSubmissionNotificationEmail(opts: SendSubmissionNotificationOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"
  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.teacherEmail],
    subject: `${opts.studentName} submitted "${opts.examTitle}"`,
    html: buildHtml(opts),
  })
  if (error) throw new Error(`Failed to send submission notification email: ${error.message}`)
}
