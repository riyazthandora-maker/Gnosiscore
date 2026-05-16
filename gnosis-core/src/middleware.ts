import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_PREFIXES = ["/dashboard", "/documents", "/tests", "/analytics", "/settings", "/test", "/shared"]
const AUTH_ROUTES = ["/login", "/register"]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some((p) => path.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectTo", path)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
