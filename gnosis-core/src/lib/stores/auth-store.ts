import { create } from "zustand"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import type { User } from "@/types"

interface AuthState {
  supabaseUser: SupabaseUser | null
  profile: User | null
  setSupabaseUser: (user: SupabaseUser | null) => void
  setProfile: (profile: User | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  supabaseUser: null,
  profile: null,
  setSupabaseUser: (user) => set({ supabaseUser: user }),
  setProfile: (profile) => set({ profile }),
  clear: () => set({ supabaseUser: null, profile: null }),
}))
