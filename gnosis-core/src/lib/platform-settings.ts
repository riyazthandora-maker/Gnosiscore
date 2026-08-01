import { createAdminClient } from "@/lib/supabase/admin"
import type { EffectiveLimits } from "@/types"

export interface PlatformSettings {
  file_size_limit_bytes: number
  question_approval_threshold: number
  max_pause_duration_seconds: number
  max_storage_bytes: number
  max_docs_per_chapter: number
  monthly_upload_limit: number
}

const DEFAULTS: PlatformSettings = {
  file_size_limit_bytes: 4 * 1024 * 1024,
  question_approval_threshold: 20,
  max_pause_duration_seconds: 900,
  max_storage_bytes: 200 * 1024 * 1024,
  max_docs_per_chapter: 10,
  monthly_upload_limit: 100,
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const adminDb = createAdminClient()
    const { data } = await adminDb
      .from("platform_settings")
      .select(
        "file_size_limit_bytes, question_approval_threshold, max_pause_duration_seconds, max_storage_bytes, max_docs_per_chapter, monthly_upload_limit"
      )
      .eq("id", 1)
      .single()
    return { ...DEFAULTS, ...(data ?? {}) }
  } catch {
    return DEFAULTS
  }
}

export async function getEffectiveLimits(userId: string): Promise<EffectiveLimits> {
  const adminDb = createAdminClient()
  const [platform, { data: userRow }] = await Promise.all([
    getPlatformSettings(),
    adminDb
      .from("users")
      .select("storage_limit_bytes, doc_size_limit_bytes, max_docs_per_chapter, monthly_upload_limit")
      .eq("id", userId)
      .single(),
  ])
  return {
    doc_size_limit_bytes: userRow?.doc_size_limit_bytes ?? platform.file_size_limit_bytes,
    max_docs_per_chapter: userRow?.max_docs_per_chapter ?? platform.max_docs_per_chapter,
    storage_limit_bytes:  userRow?.storage_limit_bytes  ?? platform.max_storage_bytes,
    monthly_upload_limit: userRow?.monthly_upload_limit ?? platform.monthly_upload_limit,
  }
}

export async function getEffectiveQuestionThreshold(userId: string): Promise<number> {
  const adminDb = createAdminClient()
  const [platform, { data: userRow }] = await Promise.all([
    getPlatformSettings(),
    adminDb
      .from("users")
      .select("question_approval_threshold")
      .eq("id", userId)
      .single(),
  ])
  return userRow?.question_approval_threshold ?? platform.question_approval_threshold
}
