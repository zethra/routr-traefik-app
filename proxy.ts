import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const skipAuth = process.env.SKIP_AUTH === 'true'

export default auth((req) => {
  // Bypass auth in development mode
  if (skipAuth) {
    return NextResponse.next()
  }

  const pathname = req.nextUrl.pathname

  const isAuthRoute = pathname.startsWith('/api/auth')
  const isLoginRoute = pathname === '/login'
  const isTraefikConfigRoute = /^\/api\/[^/]+$/.test(pathname)

  if (isAuthRoute || isLoginRoute || isTraefikConfigRoute) {
    return NextResponse.next()
  }

  if (!req.auth) {
    const loginUrl = new URL('/login', req.nextUrl)
    loginUrl.searchParams.set('callbackUrl', `${pathname}${req.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
