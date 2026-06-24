import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOKEN   = process.env.SUPABASE_ACCESS_TOKEN || ""
const PROJECT = "yjusiwggbufigtewqdcr"

if (!TOKEN) { console.error("Missing SUPABASE_ACCESS_TOKEN"); process.exit(1) }

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
  console.log(text.slice(0, 800))
  if (!res.ok) process.exit(1)
}

await runSql("Phase 2 migration", "phase2.sql")
console.log("\n✓ Phase 2 migration complete")
