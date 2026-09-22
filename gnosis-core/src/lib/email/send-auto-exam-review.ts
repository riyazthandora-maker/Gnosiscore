import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendAutoExamReviewOptions {
  teacherEmail: string
  teacherName: string
  chapterTitle: string
  planTitle: string
  reviewUrl: string
}

function buildHtml(opts: SendAutoExamReviewOptions): string {
  const { teacherName, chapterTitle, planTitle, reviewUrl } = opts
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chapter Check Ready for Review — GnosisCore</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.8);">Scheduling Engine</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Hi ${teacherName},</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#555;">
              A chapter check has been auto-generated and is ready for your review:
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#1a1a2e;font-weight:600;">
              ${chapterTitle} — ${planTitle}
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#888;">
              Please review the questions before they are assigned to your students. You can edit, regenerate, or approve from the pacing plan.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center">
                <a href="${reviewUrl}"
                   style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  Review Exam →
                </a>
              </td></tr>
            </table>

            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              Or copy this link: <a href="${reviewUrl}" style="color:#7c3aed;word-break:break-all;">${reviewUrl}</a>
            </p>
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

export async function sendAutoExamReviewEmail(opts: SendAutoExamReviewOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"
  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.teacherEmail],
    subject: `Review ready: ${opts.chapterTitle} chapter check`,
    html: buildHtml(opts),
  })
  if (error) throw new Error(`Failed to send auto exam review email: ${error.message}`)
}
