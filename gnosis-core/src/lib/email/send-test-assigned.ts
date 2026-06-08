import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendTestAssignedOptions {
  studentEmail: string
  studentName: string
  educatorName: string
  testTitle: string
  testUrl: string
  dueAt?: string | null
}

function buildHtml(opts: SendTestAssignedOptions): string {
  const { studentName, educatorName, testTitle, testUrl, dueAt } = opts
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"

  const dueRow = dueAt
    ? `<tr>
        <td style="padding:4px 0;font-size:13px;color:#888;width:120px;">Due</td>
        <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">
          ${new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(new Date(dueAt))}
        </td>
      </tr>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Test Assigned — GnosisCore</title></head>
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
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">You have a new test!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              Hi ${studentName}, <strong style="color:#1a1a2e;">${educatorName}</strong> has assigned you a practice test.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border:1px solid #e8e3ff;border-radius:12px;margin-bottom:28px;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:.8px;">Test Details</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;width:120px;">Test</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${testTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;">Assigned by</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${educatorName}</td>
                  </tr>
                  ${dueRow}
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${testUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  Take Test →
                </a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              Or visit: <a href="${testUrl}" style="color:#7c3aed;">${testUrl}</a>
            </p>
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

export async function sendTestAssignedEmail(opts: SendTestAssignedOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"
  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.studentEmail],
    subject: `New test assigned: ${opts.testTitle}`,
    html: buildHtml(opts),
  })
  if (error) throw new Error(`Failed to send test assignment email: ${error.message}`)
}
