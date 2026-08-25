/**
 * Empty the "documents" storage bucket (deletes every uploaded file).
 * Usage: node supabase/clear-storage.mjs
 * Requires: SUPABASE_SERVICE_ROLE_KEY env var
 */
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://yjusiwggbufigtewqdcr.supabase.co"
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const { error } = await supabase.storage.emptyBucket("documents")
if (error) {
  console.error(`Failed to empty "documents" bucket: ${error.message}`)
  process.exit(1)
}

console.log('✓ Emptied the "documents" storage bucket')
