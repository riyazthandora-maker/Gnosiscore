export type UserRole = 'admin' | 'educator_parent' | 'student'
export type AccountStatus = 'pending' | 'approved' | 'rejected'
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'
export type GenerationStatus = 'pending_admin' | 'approved' | 'rejected' | 'completed'
export type QuestionStatus = 'pending_review' | 'approved' | 'rejected'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface User {
  id: string
  email: string
  full_name: string
  whatsapp: string
  role: UserRole
  account_status: AccountStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export interface EducatorStudent {
  id: string
  educator_id: string
  student_id: string
  linked_at: string
}

export interface Document {
  id: string
  owner_id: string
  file_name: string
  storage_path: string
  markdown_path: string | null
  processing_status: DocumentStatus
  chunk_count: number | null
  total_bytes: number
  created_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  token_count: number | null
  created_at: string
}

export interface QuestionOption {
  label: 'A' | 'B' | 'C' | 'D'
  text: string
  is_correct: boolean
}

export interface Question {
  id: string
  owner_id: string
  generation_request_id: string | null
  document_id: string | null
  chunk_ids: string[]
  question_text: string
  options: QuestionOption[]
  explanation: string | null
  difficulty: Difficulty | null
  topic_tags: string[]
  status: QuestionStatus
  reviewed_at: string | null
  created_at: string
}

export interface GenerationConfig {
  difficulty: Difficulty
  topic: string
  question_type: 'mcq' | 'true_false'
}

export interface GenerationRequest {
  id: string
  requested_by: string
  document_ids: string[]
  prompt_context: string | null
  question_count: number
  config: GenerationConfig
  status: GenerationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  admin_note: string | null
  created_at: string
}

export interface Test {
  id: string
  creator_id: string
  title: string
  description: string | null
  question_ids: string[]
  time_limit_min: number | null
  is_published: boolean
  created_at: string
}

export interface TestAssignment {
  id: string
  test_id: string
  student_id: string
  assigned_by: string
  due_at: string | null
  assigned_at: string
}

export interface TestAttempt {
  id: string
  test_id: string
  student_id: string
  answers: Record<string, number>
  score: number | null
  max_score: number | null
  config_snapshot: Record<string, unknown>
  started_at: string
  completed_at: string | null
}

export interface Notification {
  id: string
  user_id: string
  type: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

// Analytics types (Phase 6)
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

// Legacy aliases — Phase 4-5 components will be rewritten to use new types
export type Toughness = Difficulty | 'advanced'
export type ShowAnswerMode = 'immediate' | 'end' | 'hidden'
export type ConfigSnapshot = Record<string, unknown>
export type TestConfig = Record<string, unknown>

export const FILE_LIMITS = {
  perFile: 4 * 1024 * 1024,        // 4 MB
  perTransaction: 20 * 1024 * 1024, // 20 MB
} as const

export const GENERATION_ADMIN_THRESHOLD = 20
export const RAG_SIMILARITY_THRESHOLD = 0.50

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'admin':           return '/admin'
    case 'educator_parent': return '/dashboard'
    case 'student':         return '/student'
  }
}
