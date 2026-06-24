import { createAdminClient } from "@/lib/supabase/admin"

export interface PlatformSettings {
  file_size_limit_bytes: number
  question_approval_threshold: number
  max_pause_duration_seconds: number
}

const DEFAULTS: PlatformSettings = {
  file_size_limit_bytes: 4 * 1024 * 1024,
  question_approval_threshold: 20,
  max_pause_duration_seconds: 900,
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const adminDb = createAdminClient()
    const { data } = await adminDb
      .from("platform_settings")
      .select("file_size_limit_bytes, question_approval_threshold, max_pause_duration_seconds")
      .eq("id", 1)
      .single()
    return data ?? DEFAULTS
  } catch {
    return DEFAULTS
  }
}
