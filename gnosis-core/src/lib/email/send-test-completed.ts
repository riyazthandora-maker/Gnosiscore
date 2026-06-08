import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendTestCompletedOptions {
  educatorEmail: string
  educatorName: string
  studentName: string
  testTitle: string
  scorePct: number
  timeTakenSecs: number
  resultsUrl: string
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "#16a34a"
  if (pct >= 50) return "#d97706"
  return "#dc2626"
}

function buildHtml(opts: SendTestCompletedOptions): string {
  const { educatorName, studentName, testTitle, scorePct, timeTakenSecs, resultsUrl } = opts
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"
  const color = scoreColor(scorePct)

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Test Completed — GnosisCore</title></head>
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
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Test completed</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              Hi ${educatorName}, <strong style="color:#1a1a2e;">${studentName}</strong> has completed a test.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border:1px solid #e8e3ff;border-radius:12px;margin-bottom:28px;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:.8px;">Result Summary</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;width:120px;">Student</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${studentName}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;">Test</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${testTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;">Score</td>
                    <td style="padding:4px 0;font-size:14px;font-weight:700;color:${color};">${scorePct.toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;">Time taken</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${formatTime(timeTakenSecs)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${resultsUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  View Results →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
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

export async function sendTestCompletedEmail(opts: SendTestCompletedOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"
  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.educatorEmail],
    subject: `${opts.studentName} completed "${opts.testTitle}" — ${opts.scorePct.toFixed(1)}%`,
    html: buildHtml(opts),
  })
  if (error) throw new Error(`Failed to send test completion email: ${error.message}`)
}
