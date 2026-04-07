import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from './server/auth'
import { sessionOptions } from './server/auth'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.next()

  // Security headers
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (process.env['NODE_ENV'] === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss:; img-src 'self' data:;",
  )

  // Auth guard
  const path = req.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p))
  if (isPublic) return res

  // iron-session accepts ReadonlyRequestCookies from Next.js middleware
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  const session = await getIronSession<SessionData>(req.cookies as any, sessionOptions)
  if (!session.userId) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
