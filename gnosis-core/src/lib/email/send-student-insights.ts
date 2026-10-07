import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

export interface InsightsEmailOptions {
  studentName: string
  studentEmail: string
  teacherName: string
  examsCount: number
  avgScore: number | null
  trendDelta: number | null
  aiAdvisory: string | null
  strongTopics: { topic: string; accuracy_pct: number }[]
  weakTopics: { topic: string; accuracy_pct: number }[]
  examHistory: { test_title: string; pct: number; completed_at: string }[]
  reportUrl: string
}

function scoreColor(pct: number) {
  if (pct >= 80) return "#16a34a"
  if (pct >= 60) return "#d97706"
  return "#dc2626"
}

function trendLabel(delta: number | null): string {
  if (delta === null) return "—"
  if (delta > 5) return `+${delta}% ↑`
  if (delta < -5) return `${delta}% ↓`
  return `${delta > 0 ? "+" : ""}${delta}% →`
}

function trendColor(delta: number | null): string {
  if (delta === null) return "#6b7280"
  if (delta > 5) return "#16a34a"
  if (delta < -5) return "#dc2626"
  return "#6b7280"
}

function buildHtml(opts: InsightsEmailOptions): string {
  const {
    studentName, teacherName, examsCount, avgScore,
    trendDelta, aiAdvisory, strongTopics, weakTopics,
    examHistory, reportUrl,
  } = opts

  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date())

  const recentExams = [...examHistory]
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, 8)

  const topStrong = strongTopics.slice(0, 4)
  const topWeak = weakTopics.slice(0, 4)

  const examRows = recentExams.map(e => {
    const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(e.completed_at))
    return `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:10px 0;font-size:13px;color:#1a1a2e;">${e.test_title}</td>
        <td style="padding:10px 8px;font-size:12px;color:#6b7280;white-space:nowrap;">${date}</td>
        <td style="padding:10px 0;text-align:right;">
          <span style="font-size:13px;font-weight:700;color:${scoreColor(e.pct)};">${e.pct}%</span>
        </td>
      </tr>`
  }).join("")

  const topicRows = (topics: typeof topStrong, color: string) =>
    topics.map(t => `
      <tr>
        <td style="padding:5px 0;font-size:12px;color:#374151;">${t.topic}</td>
        <td style="padding:5px 0 5px 12px;text-align:right;white-space:nowrap;">
          <span style="font-size:12px;font-weight:700;color:${color};">${t.accuracy_pct}%</span>
        </td>
      </tr>`
    ).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Student Progress Report — ${studentName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">GnosisCore</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.75);">Student Progress Report</p>
          </td>
        </tr>

        <!-- Student info -->
        <tr>
          <td style="padding:28px 32px 0;">
            <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1a1a2e;">${studentName}</h1>
            <p style="margin:0;font-size:12px;color:#9ca3af;">Prepared by ${teacherName} · ${generatedAt}</p>
          </td>
        </tr>

        <!-- Stats row -->
        <tr>
          <td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33%" style="padding-right:8px;">
                  <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px;text-align:center;">
                    <p style="margin:0;font-size:24px;font-weight:700;color:#7c3aed;">${examsCount}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Exams Taken</p>
                  </div>
                </td>
                <td width="33%" style="padding:0 4px;">
                  <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px;text-align:center;">
                    <p style="margin:0;font-size:24px;font-weight:700;color:#7c3aed;">${avgScore !== null ? `${avgScore}%` : "—"}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Average Score</p>
                  </div>
                </td>
                <td width="33%" style="padding-left:8px;">
                  <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px;text-align:center;">
                    <p style="margin:0;font-size:24px;font-weight:700;color:${trendColor(trendDelta)};">${trendLabel(trendDelta)}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Score Trend</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${aiAdvisory ? `
        <!-- AI Advisory -->
        <tr>
          <td style="padding:20px 32px 0;">
            <div style="background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;">AI Advisory</p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#374151;">${aiAdvisory}</p>
            </div>
          </td>
        </tr>` : ""}

        ${(topStrong.length > 0 || topWeak.length > 0) ? `
        <!-- Topics -->
        <tr>
          <td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${topStrong.length > 0 ? `
                <td width="48%" style="vertical-align:top;padding-right:8px;">
                  <div style="border:1px solid #bbf7d0;border-radius:10px;padding:14px;">
                    <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;">Strong Topics</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${topicRows(topStrong, "#16a34a")}
                    </table>
                  </div>
                </td>` : ""}
                ${topWeak.length > 0 ? `
                <td width="48%" style="vertical-align:top;padding-left:8px;">
                  <div style="border:1px solid #fde68a;border-radius:10px;padding:14px;">
                    <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#d97706;">Needs Attention</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${topicRows(topWeak, "#d97706")}
                    </table>
                  </div>
                </td>` : ""}
              </tr>
            </table>
          </td>
        </tr>` : ""}

        ${recentExams.length > 0 ? `
        <!-- Exam history -->
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Exam History</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;">
              ${examRows}
            </table>
          </td>
        </tr>` : ""}

        <!-- CTA -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${reportUrl}"
                   style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:10px;letter-spacing:.2px;">
                  View Full Report →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 20px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#bbb;">
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

export async function sendStudentInsightsEmail(opts: InsightsEmailOptions): Promise<void> {
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? "onboarding@resend.dev"
  const { error } = await resend.emails.send({
    from: `GnosisCore <${fromDomain}>`,
    to: [opts.studentEmail],
    subject: `Progress Report — ${opts.studentName}`,
    html: buildHtml(opts),
  })
  if (error) throw new Error(`Failed to send insights email: ${error.message}`)
}
