export type BlockLevel = "chapter" | "section" | "details"

export interface FlatBlock {
  id: string
  level: BlockLevel
  text: string
}

export type BookRole = "owner" | "editor" | "viewer"

export interface Collaborator {
  user_id: string
  email: string
  full_name: string
  role: "editor" | "viewer"
  added_at: string
}

export interface Book {
  id: string
  owner_id: string
  title: string
  blocks: FlatBlock[]
  role: BookRole
  createdAt: string
  updatedAt: string
}

export interface BookSummary {
  id: string
  title: string
  blockCount: number
  updatedAt: string
  role: BookRole
}
