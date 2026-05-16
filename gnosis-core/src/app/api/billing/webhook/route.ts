import { createAdminClient } from "@/lib/supabase/admin"
import stripe from "@/lib/stripe"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

// Must be raw body — disable Next.js body parsing via route segment config
export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")

  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      if (userId) {
        await supabase.from("users").update({ tier: "pro" }).eq("id", userId)
      }
      break
    }

    case "customer.subscription.deleted": {
      // Downgrade back to basic when subscription is cancelled
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (userId) {
        await supabase.from("users").update({ tier: "basic" }).eq("id", userId)
      }
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id
      if (userId) {
        const isActive = ["active", "trialing"].includes(subscription.status)
        await supabase.from("users").update({ tier: isActive ? "pro" : "basic" }).eq("id", userId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
