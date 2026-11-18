import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const protectedRoutes = ['/dashboard']
const publicRoutes = ['/login', '/']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = path.startsWith('/dashboard')
  const isLoginPage = path === '/login'

  // Fast-path: immediately pass through public routes without JWT decryption
  if (!isProtectedRoute && !isLoginPage) {
    return NextResponse.next()
  }

  const cookie = req.cookies.get('session')?.value

  // Fast-path: redirect to login if accessing protected route without session cookie
  if (isProtectedRoute && !cookie) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  const session = await decrypt(cookie)

  // Redirect to login if accessing protected route with invalid session
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // Redirect to dashboard if logged in and accessing login page
  if (isLoginPage && session?.userId) {
    const role = session.role
    let dashboardPath = '/dashboard/warga'
    if (role === 'STAF') dashboardPath = '/dashboard/staf'
    else if (role === 'SUPERVISOR') dashboardPath = '/dashboard/supervisor'
    else if (role === 'ADMIN') dashboardPath = '/dashboard/admin'
    
    return NextResponse.redirect(new URL(dashboardPath, req.nextUrl))
  }

  // RBAC checks for specific dashboard paths
  if (path.startsWith('/dashboard/')) {
    const role = session?.role
    
    if (path.startsWith('/dashboard/admin') && role !== 'ADMIN') {
      return NextResponse.rewrite(new URL('/403', req.nextUrl))
    }
    if (path.startsWith('/dashboard/supervisor') && role !== 'SUPERVISOR') {
      return NextResponse.rewrite(new URL('/403', req.nextUrl))
    }
    if (path.startsWith('/dashboard/staf') && role !== 'STAF' && role !== 'ADMIN') {
      return NextResponse.rewrite(new URL('/403', req.nextUrl))
    }
    if (path.startsWith('/dashboard/warga') && role !== 'WARGA' && role !== 'CITIZEN') {
      return NextResponse.rewrite(new URL('/403', req.nextUrl))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
