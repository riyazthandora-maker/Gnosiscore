import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.org"
const fromDomain = () => process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

export async function sendAdminGenerationRequestAlert(opts: {
  adminEmail: string
  educatorName: string
  educatorEmail: string
  requestName: string
  questionCount: number
}): Promise<void> {
  const { adminEmail, educatorName, educatorEmail, requestName, questionCount } = opts
  const reviewUrl = `${appUrl()}/admin/generation-requests`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Generation Request Pending — GnosisCore</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore Admin</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.8);">Action required — generation request pending</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a2e;">New question generation request</h1>
            <p style="margin:0 0 20px;font-size:15px;color:#555;">
              An educator has submitted a request that exceeds the auto-approve threshold and needs your review:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8fc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #ede9ff;">
              <tr><td style="padding:8px 0;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Educator</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a2e;">${educatorName} <span style="font-weight:400;color:#888;">&lt;${educatorEmail}&gt;</span></p>
              </td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #f0eeff;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Batch name</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a2e;">${requestName}</p>
              </td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #f0eeff;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Questions requested</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#7c3aed;">${questionCount}</p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${reviewUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  Review &amp; Approve →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">GnosisCore Admin · <a href="${appUrl()}" style="color:#7c3aed;text-decoration:none;">gnosiscore.org</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain()}>`,
    to: [adminEmail],
    subject: `⚠️ Generation request needs approval — ${questionCount} questions by ${educatorName}`,
    html,
  })

  if (error) throw new Error(`Failed to send admin generation alert: ${error.message}`)
}

export async function sendAdminNewRegistrationAlert(opts: {
  adminEmail: string
  fullName: string
  email: string
  whatsapp?: string | null
}): Promise<void> {
  const { adminEmail, fullName, email, whatsapp } = opts
  const reviewUrl = `${appUrl()}/admin/registrations`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Educator Registration — GnosisCore</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore Admin</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.8);">New educator account awaiting approval</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a2e;">New educator registration</h1>
            <p style="margin:0 0 20px;font-size:15px;color:#555;">
              A new educator/parent has registered and is waiting for your approval to access GnosisCore:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8fc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #ede9ff;">
              <tr><td style="padding:8px 0;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Full name</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a2e;">${fullName}</p>
              </td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #f0eeff;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Email</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a2e;">${email}</p>
              </td></tr>
              ${whatsapp ? `<tr><td style="padding:8px 0;border-top:1px solid #f0eeff;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">WhatsApp</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a2e;">${whatsapp}</p>
              </td></tr>` : ""}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${reviewUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
                  Review Registration →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;">GnosisCore Admin · <a href="${appUrl()}" style="color:#7c3aed;text-decoration:none;">gnosiscore.org</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain()}>`,
    to: [adminEmail],
    subject: `🆕 New educator registration — ${fullName}`,
    html,
  })

  if (error) throw new Error(`Failed to send admin registration alert: ${error.message}`)
}
