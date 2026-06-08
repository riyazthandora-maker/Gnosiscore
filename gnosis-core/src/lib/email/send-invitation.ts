import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendInvitationOptions {
  inviteeEmail: string
  inviterName: string
  documentTitle: string
  toughness: string
  totalQuestions: number
  totalTimeSecs: number | null
  inviteUrl: string
  expiresAt: string
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  return m > 0 ? `${m} minutes` : `${secs} seconds`
}

function buildHtml(opts: SendInvitationOptions): string {
  const {
    inviterName, documentTitle, toughness,
    totalQuestions, totalTimeSecs, inviteUrl, expiresAt,
  } = opts

  const expiryDate = new Intl.DateTimeFormat("en", {
    dateStyle: "long", timeStyle: "short",
  }).format(new Date(expiresAt))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Test Invitation — GnosisCore</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.8);">AI-Powered Practice Tests</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">You've been invited!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              <strong style="color:#1a1a2e;">${inviterName}</strong> has invited you to take a practice test on GnosisCore.
            </p>

            <!-- Test details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border:1px solid #e8e3ff;border-radius:12px;margin-bottom:28px;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:.8px;">Test Details</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;width:120px;">Document</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${documentTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;">Difficulty</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;text-transform:capitalize;">${toughness}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;">Questions</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${totalQuestions}</td>
                  </tr>
                  ${totalTimeSecs ? `<tr>
                    <td style="padding:4px 0;font-size:13px;color:#888;">Time limit</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${formatTime(totalTimeSecs)}</td>
                  </tr>` : ""}
                </table>
              </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${inviteUrl}"
                   style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  Start Test →
                </a>
              </td></tr>
            </table>

            <p style="margin:0 0 6px;font-size:12px;color:#aaa;text-align:center;">
              Or copy this link: <a href="${inviteUrl}" style="color:#7c3aed;word-break:break-all;">${inviteUrl}</a>
            </p>
            <p style="margin:0;font-size:12px;color:#ccc;text-align:center;">Expires ${expiryDate}</p>
          </td>
        </tr>

        <!-- Footer -->
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

export async function sendInvitationEmail(opts: SendInvitationOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.inviteeEmail],
    subject: `${opts.inviterName} invited you to take a practice test`,
    html: buildHtml(opts),
  })

  if (error) {
    throw new Error(`Failed to send invitation email: ${error.message}`)
  }
}
