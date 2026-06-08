import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

type NotificationType = "approved" | "rejected" | "questions_ready"

interface SendGenerationNotificationOptions {
  toEmail: string
  educatorName: string
  generationName: string
  questionCount: number
  type: NotificationType
  adminNote?: string | null
  reviewUrl?: string
}

function buildHtml(opts: SendGenerationNotificationOptions): string {
  const { educatorName, generationName, questionCount, type, adminNote, reviewUrl } = opts
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"

  const headerBg =
    type === "approved" || type === "questions_ready"
      ? "linear-gradient(135deg,#7c3aed,#6d28d9)"
      : "linear-gradient(135deg,#dc2626,#b91c1c)"

  const body =
    type === "approved"
      ? `<p style="margin:0 0 16px;font-size:15px;color:#555;">
           Hi ${educatorName}, your question generation request <strong style="color:#1a1a2e;">"${generationName}"</strong>
           has been approved. Generation is now running — you'll receive another email when your questions are ready to review.
         </p>`
      : type === "rejected"
      ? `<p style="margin:0 0 16px;font-size:15px;color:#555;">
           Hi ${educatorName}, your request <strong style="color:#1a1a2e;">"${generationName}"</strong> was not approved.
         </p>
         ${adminNote ? `
         <div style="background:#fff3f3;border:1px solid #ffd0d0;border-radius:8px;padding:16px;margin-bottom:20px;">
           <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#c00;">Reason:</p>
           <p style="margin:0;font-size:14px;color:#555;">${adminNote}</p>
         </div>` : ""}`
      : `<p style="margin:0 0 16px;font-size:15px;color:#555;">
           Hi ${educatorName}, <strong>${questionCount} question${questionCount !== 1 ? "s" : ""}</strong>
           from <strong style="color:#1a1a2e;">"${generationName}"</strong> are ready for your review.
           Go to the review page to approve or edit them before adding them to a test.
         </p>`

  const cta =
    type !== "rejected" && reviewUrl
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
           <tr><td align="center">
             <a href="${reviewUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:.2px;">
               ${type === "questions_ready" ? "Review Questions →" : "Go to Dashboard →"}
             </a>
           </td></tr>
         </table>`
      : ""

  const titles: Record<NotificationType, string> = {
    approved: "Generation request approved",
    rejected: "Generation request not approved",
    questions_ready: "Your questions are ready!",
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>${titles[type]} — GnosisCore</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr>
          <td style="background:${headerBg};padding:32px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.8);">AI-Powered Practice Tests</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e;">${titles[type]}</h1>
            ${body}
            ${cta}
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

export async function sendGenerationNotification(opts: SendGenerationNotificationOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"
  const subjects: Record<NotificationType, string> = {
    approved: `Generation approved: "${opts.generationName}"`,
    rejected: `Generation request not approved: "${opts.generationName}"`,
    questions_ready: `${opts.questionCount} questions ready to review — "${opts.generationName}"`,
  }
  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.toEmail],
    subject: subjects[opts.type],
    html: buildHtml(opts),
  })
  if (error) throw new Error(`Failed to send generation notification: ${error.message}`)
}
