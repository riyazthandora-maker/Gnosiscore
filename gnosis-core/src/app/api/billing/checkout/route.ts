import { createClient } from "@/lib/supabase/server"
import stripe from "@/lib/stripe"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("tier, stripe_customer_id")
    .eq("id", user.id)
    .single()

  if (profile?.tier === "pro") {
    return NextResponse.json({ error: "Already on Pro plan." }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Reuse existing Stripe customer or create one
  let customerId: string | undefined = profile?.stripe_customer_id ?? undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: `${appUrl}/settings?upgraded=1`,
    cancel_url: `${appUrl}/settings?cancelled=1`,
    metadata: { supabase_user_id: user.id },
    subscription_data: { metadata: { supabase_user_id: user.id } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
