export type Tier = "basic" | "pro"
export type DocumentStatus = "processing" | "ready" | "failed"
export type Toughness = "easy" | "medium" | "hard" | "advanced"
export type ShowAnswerMode = "immediate" | "end" | "hidden"
export type AttemptStatus = "in_progress" | "completed" | "abandoned"
export type InvitationStatus = "pending" | "accepted" | "completed" | "expired"

export interface User {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  tier: Tier
  whatsapp_verified: boolean
  whatsapp_number: string | null
  storage_used_bytes: number
  created_at: string
}

export interface Document {
  id: string
  user_id: string
  title: string
  original_path: string
  markdown_path: string | null
  file_size_bytes: number
  status: DocumentStatus
  page_count: number | null
  token_count: number | null
  created_at: string
}

export interface TestConfig {
  id: string
  user_id: string
  document_id: string
  name: string | null
  toughness: Toughness
  total_questions: number
  total_time_secs: number | null
  per_question_secs: number | null
  show_answer_mode: ShowAnswerMode
  topic_filter: string[] | null
  created_at: string
  document?: Document
}

export interface ConfigSnapshot {
  toughness: Toughness
  total_questions: number
  total_time_secs: number | null
  per_question_secs: number | null
  show_answer_mode: ShowAnswerMode
  topic_filter: string[] | null
  document_title: string
}

export interface TestAttempt {
  id: string
  config_id: string
  user_id: string
  started_at: string
  completed_at: string | null
  score_pct: number | null
  total_answered: number
  time_taken_secs: number | null
  config_snapshot: ConfigSnapshot
  status: AttemptStatus
}

export interface QuestionOption {
  label: "A" | "B" | "C" | "D"
  text: string
}

export interface Question {
  id: string
  attempt_id: string
  seq_number: number
  body: string
  options: QuestionOption[]
  correct_option: "A" | "B" | "C" | "D"
  explanation: string | null
  topic_tag: string | null
  difficulty: Toughness | null
}

export interface Response {
  id: string
  attempt_id: string
  question_id: string
  selected_option: "A" | "B" | "C" | "D" | null
  is_correct: boolean | null
  time_spent_secs: number | null
  answered_at: string
}

export interface TopicStrength {
  topic: string
  confidence_pct: number
}

export interface TopicWeakness {
  topic: string
  error_rate_pct: number
  suggestion: string
}

export interface DiagnosticReport {
  id: string
  user_id: string
  document_id: string | null
  generated_at: string
  strengths: TopicStrength[] | null
  weaknesses: TopicWeakness[] | null
  raw_narrative: string | null
}

export interface DashboardShare {
  id: string
  owner_id: string
  viewer_id: string
  granted_at: string
}

export interface TestInvitation {
  id: string
  config_id: string
  inviter_id: string
  invitee_email: string
  token: string
  status: InvitationStatus
  expires_at: string
  created_at: string
}

export const STORAGE_LIMITS: Record<Tier, { perUpload: number; total: number }> = {
  basic: { perUpload: 2 * 1024 * 1024, total: 20 * 1024 * 1024 },
  pro: { perUpload: 10 * 1024 * 1024, total: 100 * 1024 * 1024 },
}
