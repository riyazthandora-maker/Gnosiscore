import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
// Set these env vars before running: SUPABASE_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL
const TOKEN           = process.env.SUPABASE_ACCESS_TOKEN   || ""
const PROJECT         = "yjusiwggbufigtewqdcr"
const SUPABASE_URL    = "https://yjusiwggbufigtewqdcr.supabase.co"
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const ADMIN_EMAIL     = process.env.ADMIN_EMAIL             || "admin@gnosiscore.org"
if (!TOKEN || !SERVICE_ROLE_KEY) { console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1) }
const SQL_BASE = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`

async function runSql(label, sqlFile) {
  const query = readFileSync(join(__dirname, sqlFile), "utf8")
  const res = await fetch(SQL_BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  console.log(`\n── ${label} (${res.status}) ──`)
  console.log(text.slice(0, 600))
  if (!res.ok) process.exit(1)
}

async function createAdminUser() {
  console.log(`\n── Creating admin user: ${ADMIN_EMAIL} ──`)

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      email_confirm: true,
      user_metadata: { role: "admin", full_name: "Riyaz Thandora" },
    }),
  })
  const data = await res.json()
  if (res.ok) {
    console.log(`  Created user id: ${data.id}`)
  } else if (res.status === 422 || (data.msg ?? "").toLowerCase().includes("already") || (data.error_code ?? "").includes("email")) {
    console.log("  User already exists in auth — will update role via seed")
  } else {
    // Possibly a trigger error on an existing auth record — still try seed
    console.warn(`  Warning (${res.status}): ${data.msg ?? JSON.stringify(data)} — proceeding to seed`)
  }
}

// 0. Reset old schema
await runSql("reset", "reset.sql")

// 1. Schema (tables, RLS, trigger, match_chunks RPC)
await runSql("schema", "schema.sql")

// 2. Storage bucket + policies
await runSql("storage", "storage.sql")

// 3. Create admin user in auth (trigger auto-creates public.users row)
await createAdminUser()

// 4. Promote to admin (covers existing users created before schema ran)
await runSql("seed", "seed.sql")

console.log("\n✓ Setup complete — log in at http://localhost:3000/login")
