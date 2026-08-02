import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Use the request's own origin so the redirect works on every deployment
  // (preview URLs, custom domains, local dev) without relying on NEXT_PUBLIC_APP_URL
  return NextResponse.redirect(new URL("/login", request.url))
}
