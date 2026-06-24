import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { UserRole } from "@/types"

const PUBLIC_ROUTES = ["/", "/login", "/register", "/logout", "/forgot-password", "/pending-approval", "/auth"]

const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin:           ["/admin"],
  educator_parent: ["/documents", "/tests", "/analytics", "/settings"],
  student:         ["/student"],
}

function roleHome(role: UserRole): string {
  return ROLE_ROUTES[role][0]
}

function isAllowedForRole(path: string, role: UserRole): boolean {
  return ROLE_ROUTES[role].some((prefix) => path === prefix || path.startsWith(prefix + "/"))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

  const isPublic = PUBLIC_ROUTES.some((p) => path === p || path.startsWith(p + "/"))

  if (!user) {
    if (isPublic) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectTo", path)
    return NextResponse.redirect(url)
  }

  // User is authenticated
  const role = (user.user_metadata?.role ?? "student") as UserRole

  // Block deactivated educator accounts (skip API routes — they handle auth themselves)
  if (role === "educator_parent" && !path.startsWith("/api/")) {
    const { data: dbUser } = await supabase
      .from("users")
      .select("is_active")
      .eq("id", user.id)
      .single()
    if (dbUser && dbUser.is_active === false) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("reason", "deactivated")
      return NextResponse.redirect(url)
    }
  }

  // Redirect auth pages → role home
  if (path === "/login" || path === "/register") {
    const url = request.nextUrl.clone()
    url.pathname = roleHome(role)
    return NextResponse.redirect(url)
  }

  // Block cross-role access
  const isRoleLocked = Object.values(ROLE_ROUTES).flat().some(
    (prefix) => path === prefix || path.startsWith(prefix + "/")
  )
  if (isRoleLocked && !isAllowedForRole(path, role)) {
    const url = request.nextUrl.clone()
    url.pathname = roleHome(role)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
