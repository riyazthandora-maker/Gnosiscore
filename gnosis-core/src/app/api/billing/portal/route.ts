import { createClient } from "@/lib/supabase/server"
import stripe from "@/lib/stripe"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found." }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${appUrl}/settings`,
  })

  return NextResponse.json({ url: session.url })
}
