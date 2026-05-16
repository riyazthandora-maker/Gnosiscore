"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push("/dashboard")
    router.refresh()
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">Display name</label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t border-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>
    </form>
  )
}
