import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.org"
const fromDomain = () => process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"

export async function sendEoiAlertToTeacher(opts: {
  teacherEmail: string
  studentName: string
  studentEmail: string
  studentGrade: string
}): Promise<void> {
  const { teacherEmail, studentName, studentEmail, studentGrade } = opts
  const studentsUrl = `${appUrl()}/students`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New Expression of Interest — GnosisCore</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">GnosisCore</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8);">New EOI on website</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a1a2e;">New expression of interest received</p>
            <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
              A student has expressed interest in joining GnosisCore after viewing their talent report.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8fc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #ede9ff;">
              <tr><td style="padding:8px 0;">
                <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Student</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a2e;">${studentName}</p>
              </td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #f0eeff;">
                <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Email</p>
                <p style="margin:4px 0 0;font-size:14px;color:#1a1a2e;">${studentEmail}</p>
              </td></tr>
              ${studentGrade ? `<tr><td style="padding:8px 0;border-top:1px solid #f0eeff;">
                <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Grade</p>
                <p style="margin:4px 0 0;font-size:14px;color:#1a1a2e;">${studentGrade}</p>
              </td></tr>` : ""}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${studentsUrl}" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
                  View in Students →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#bbb;"><a href="${appUrl()}" style="color:#7c3aed;text-decoration:none;">GnosisCore</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain()}>`,
    to: [teacherEmail],
    subject: `New EOI in website — ${studentName}`,
    html,
  })

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[send-eoi-alert] Resend blocked. EOI from:", studentEmail)
      return
    }
    throw new Error(`Failed to send EOI alert: ${error.message}`)
  }
}
