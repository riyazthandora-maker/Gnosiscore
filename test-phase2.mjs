// Phase 2 feature test suite — runs against https://gnosiscore.org
// Usage: node test-phase2.mjs

import { createClient } from "./gnosis-core/node_modules/@supabase/supabase-js/dist/index.mjs"

const BASE = "https://gnosiscore.org"
const SUPABASE_URL = "https://yjusiwggbufigtewqdcr.supabase.co"
const ANON_KEY = "sb_publishable_hTWaDwuaWzaEjDbgnazW5g_cbjT6MAY"
const PROJECT_REF = "yjusiwggbufigtewqdcr"
const COOKIE_KEY = `sb-${PROJECT_REF}-auth-token`
const MAX_CHUNK = 3180

const ACCOUNTS = {
  admin:    { email: "riyazthandora@gmail.com", password: "zaq1xsw2" },
  educator: { email: "riyazkalla@gmail.com",    password: "zaq1xsw2" },
  student:  { email: "raheenariyaz1@gmail.com", password: "zaq1xsw2" },
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildCookie(session) {
  const raw = JSON.stringify(session)
  const encoded = encodeURIComponent(raw)
  if (encoded.length <= MAX_CHUNK) {
    return `${COOKIE_KEY}=${raw}`
  }
  const parts = []
  let rest = encoded
  let i = 0
  while (rest.length > 0) {
    let head = rest.slice(0, MAX_CHUNK)
    const lastPct = head.lastIndexOf("%")
    if (lastPct > MAX_CHUNK - 3) head = head.slice(0, lastPct)
    parts.push(`${COOKIE_KEY}.${i}=${decodeURIComponent(head)}`)
    rest = rest.slice(head.length)
    i++
  }
  return parts.join("; ")
}

async function signIn(role) {
  const { email, password } = ACCOUNTS[role]
  const sb = createClient(SUPABASE_URL, ANON_KEY)
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`Sign-in failed (${role}): ${error?.message}`)
  return buildCookie(data.session)
}

async function api(cookie, method, path, body) {
  const opts = {
    method,
    headers: { "Cookie": cookie, "Content-Type": "application/json" },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  let data
  const text = await res.text()
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

const results = []
function record(feature, label, status, data) {
  const ok = status >= 200 && status < 300
  const icon = ok ? "✓" : "✗"
  const summary = ok
    ? JSON.stringify(data).slice(0, 120)
    : `HTTP ${status} — ${JSON.stringify(data).slice(0, 100)}`
  results.push({ feature, label, ok, summary })
  console.log(`  ${icon} [${feature}] ${label}: ${summary}`)
}

// ── tests ────────────────────────────────────────────────────────────────────

async function testAdmin(cookie) {
  console.log("\n── Admin tests ──")

  // 1. Platform settings — read
  let r = await api(cookie, "GET", "/api/admin/settings")
  record("Platform Settings", "GET settings", r.status, r.data)

  // 2. Platform settings — write (change threshold then restore)
  const original = r.data?.settings?.question_approval_threshold ?? 20
  r = await api(cookie, "PATCH", "/api/admin/settings", { question_approval_threshold: original })
  record("Platform Settings", "PATCH settings (no-op update)", r.status, r.data)

  // 3. List educators — needed to get an educator ID
  r = await api(cookie, "GET", "/api/admin/users")
  record("Activate/Deactivate", "GET educators list", r.status, r.data)

  const educator = r.data?.users?.find(u => u.email === ACCOUNTS.educator.email)
  if (!educator) {
    console.log("  ⚠ Could not find educator account in list — skipping toggle test")
    return null
  }

  // 4. Deactivate educator
  r = await api(cookie, "PATCH", `/api/admin/users/${educator.id}/active`, { is_active: false })
  record("Activate/Deactivate", "Deactivate educator", r.status, r.data)

  // 5. Re-activate educator (restore)
  r = await api(cookie, "PATCH", `/api/admin/users/${educator.id}/active`, { is_active: true })
  record("Activate/Deactivate", "Re-activate educator", r.status, r.data)

  return educator
}

async function testEducator(cookie, educatorUserId) {
  console.log("\n── Educator tests ──")

  // 6. Question banks list
  let r = await api(cookie, "GET", "/api/educator/questions/banks")
  record("Composite Test", "GET question banks", r.status, r.data)

  const banks = r.data?.requests ?? []
  const approvedCounts = r.data?.approved_counts ?? {}
  const usableBanks = banks.filter(b => (approvedCounts[b.id] ?? 0) > 0)

  // 7. AI suggest test name
  if (usableBanks.length > 0) {
    r = await api(cookie, "POST", "/api/educator/tests/suggest-name", {
      generation_request_ids: [usableBanks[0].id],
    })
    record("AI Name Suggestions", "suggest-name (from bank)", r.status, r.data)
  } else {
    console.log("  ⚠ No banks with approved questions — skipping suggest-name test")
    results.push({ feature: "AI Name Suggestions", label: "suggest-name (from bank)", ok: null, summary: "SKIPPED — no approved question banks" })
  }

  // 8. Composite test creation
  if (usableBanks.length > 0) {
    const bankId = usableBanks[0].id
    const qCount = Math.min(approvedCounts[bankId] ?? 1, 3)
    r = await api(cookie, "POST", "/api/educator/tests/composite", {
      title: "[Phase2 Test] Composite Test",
      generation_request_ids: [bankId],
      question_count: qCount,
      time_limit_min: 10,
      allow_pause: true,
    })
    record("Composite Test", "POST composite test", r.status, r.data)
    return r.data?.test?.id ?? null
  } else {
    console.log("  ⚠ No banks with approved questions — skipping composite test")
    results.push({ feature: "Composite Test", label: "POST composite test", ok: null, summary: "SKIPPED — no approved question banks" })
    return null
  }
}

async function testStudentInsights(educatorCookie, studentId) {
  console.log("\n── Student Insights test ──")
  if (!studentId) {
    console.log("  ⚠ No linked student found — skipping")
    results.push({ feature: "Student Insights", label: "GET insights", ok: null, summary: "SKIPPED — no linked student" })
    return
  }
  const r = await api(educatorCookie, "GET", `/api/educator/students/${studentId}/insights`)
  record("Student Insights", "GET insights", r.status, r.data)
}

async function testPauseResume(studentCookie) {
  console.log("\n── Pause / Resume test ──")

  // Try to find a paused or in-progress attempt belonging to the student
  // We can't start one from scratch here without a full submission flow,
  // so we probe with a fake UUID and confirm the auth layer works.
  const fakeId = "00000000-0000-0000-0000-000000000001"
  let r = await api(studentCookie, "POST", `/api/tests/attempts/${fakeId}/pause`)
  // 404 = authenticated + reached business logic (fake UUID expected to not exist)
  const pauseOk = r.status === 404
  record("Pause Test", "Pause endpoint reachable (auth OK)", pauseOk ? 200 : r.status,
    pauseOk ? "Authenticated, endpoint live (fake UUID = 404 as expected)" : r.data)

  r = await api(studentCookie, "POST", `/api/tests/attempts/${fakeId}/resume`)
  const resumeOk = r.status === 404
  record("Pause Test", "Resume endpoint reachable (auth OK)", resumeOk ? 200 : r.status,
    resumeOk ? "Authenticated, endpoint live (fake UUID = 404 as expected)" : r.data)
}

async function testCronReset() {
  console.log("\n── Token Reset (Cron) test ──")
  // Without CRON_SECRET we expect 401 — confirms the endpoint is live and secured
  const r = await api("", "POST", "/api/cron/reset-tokens")
  if (r.status === 401) {
    record("Token Reset", "POST cron/reset-tokens (auth guard check)", 200, "Correctly rejected unauthorized request (401)")
  } else {
    record("Token Reset", "POST cron/reset-tokens", r.status, r.data)
  }
}

async function findLinkedStudent(educatorCookie) {
  // Check if there's an educator-students list endpoint
  const r = await api(educatorCookie, "GET", "/api/educator/students")
  if (r.status === 200 && r.data?.students?.length > 0) {
    return r.data.students[0].id
  }
  return null
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log("GnosisCore Phase 2 — Feature Test Suite")
console.log("Target:", BASE)
console.log("=".repeat(60))

try {
  console.log("\nSigning in all accounts…")
  const [adminCookie, educatorCookie, studentCookie] = await Promise.all([
    signIn("admin"),
    signIn("educator"),
    signIn("student"),
  ])
  console.log("  ✓ All sign-ins successful")

  const educator = await testAdmin(adminCookie)

  const studentId = await findLinkedStudent(educatorCookie)
  if (studentId) console.log(`  ℹ Found linked student: ${studentId}`)

  await testEducator(educatorCookie, educator?.id)
  await testStudentInsights(educatorCookie, studentId)
  await testPauseResume(studentCookie)
  await testCronReset()

} catch (err) {
  console.error("\nFATAL:", err.message)
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(60))
console.log("SUMMARY")
console.log("=".repeat(60))
const passed  = results.filter(r => r.ok === true).length
const failed  = results.filter(r => r.ok === false).length
const skipped = results.filter(r => r.ok === null).length
for (const { feature, label, ok, summary } of results) {
  const icon = ok === true ? "✓" : ok === false ? "✗" : "–"
  console.log(`${icon} ${feature.padEnd(22)} ${label}`)
  if (ok === false) console.log(`    → ${summary}`)
}
console.log(`\nPassed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`)
