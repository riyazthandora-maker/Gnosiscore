import Stripe from "stripe"

// Singleton — avoids creating a new client on every hot-reload
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
})

export default stripe
