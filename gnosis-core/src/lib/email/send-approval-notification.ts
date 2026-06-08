import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

function buildApprovedHtml(fullName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Account Approved — GnosisCore</title></head>
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
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e;">Your account has been approved!</h1>
            <p style="margin:0 0 16px;font-size:15px;color:#555;">Hi ${fullName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              Great news — your GnosisCore educator account has been reviewed and approved.
              You can now log in and start creating AI-generated practice tests for your students.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${appUrl}/login"
                   style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  Go to Dashboard →
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

function buildRejectedHtml(fullName: string, note?: string | null): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Account Update — GnosisCore</title></head>
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
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e;">Update on your registration</h1>
            <p style="margin:0 0 16px;font-size:15px;color:#555;">Hi ${fullName},</p>
            <p style="margin:0 0 16px;font-size:15px;color:#555;">
              Thank you for registering with GnosisCore. After review, we were unable to approve
              your educator account at this time.
            </p>
            ${note ? `
            <div style="background:#fff3f3;border:1px solid #ffd0d0;border-radius:8px;padding:16px;margin-bottom:20px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#c00;">Reason:</p>
              <p style="margin:0;font-size:14px;color:#555;">${note}</p>
            </div>` : ""}
            <p style="margin:0;font-size:14px;color:#888;">
              If you believe this is an error, please contact our support team.
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

export async function sendApprovalNotification(opts: {
  toEmail: string
  fullName: string
  action: "approved" | "rejected"
  note?: string | null
}): Promise<void> {
  const { toEmail, fullName, action, note } = opts
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

  const subject = action === "approved"
    ? "Your GnosisCore account has been approved!"
    : "Update on your GnosisCore registration"

  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [toEmail],
    subject,
    html: action === "approved"
      ? buildApprovedHtml(fullName)
      : buildRejectedHtml(fullName, note),
  })

  if (error) throw new Error(`Failed to send notification: ${error.message}`)
}
