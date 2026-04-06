import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'))
}

function isRetryableAuthFailure(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const authError = error as { name?: string; message?: string; status?: number }
  if (authError.name === 'AuthRetryableFetchError') return true
  if (authError.status === 0) return true

  const message = authError.message?.toLowerCase() ?? ''
  return message.includes('fetch') || message.includes('network') || message.includes('timeout')
}

export async function proxy(request: NextRequest) {
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

  // Refresh the session - do not add any code between createServerClient and getUser.
  let user = null
  let authError: unknown = null
  try {
    const { data, error } = await supabase.auth.getUser()
    user = data.user
    authError = error
  } catch (error) {
    authError = error
  }

  const { pathname } = request.nextUrl

  const allowOfflineDashboard =
    pathname.startsWith('/dashboard') &&
    !user &&
    hasSupabaseAuthCookie(request) &&
    isRetryableAuthFailure(authError)

  // Redirect unauthenticated users away from dashboard.
  if (!user && pathname.startsWith('/dashboard') && !allowOfflineDashboard) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login/register.
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/overview'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
