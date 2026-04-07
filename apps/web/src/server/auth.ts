import { getIronSession, unsealData, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import type { IncomingMessage } from 'node:http'

export interface SessionData {
  userId?: string
  username?: string
}

if (!process.env['SESSION_PASSWORD']) {
  throw new Error('SESSION_PASSWORD environment variable is required')
}

export const sessionOptions: SessionOptions = {
  password: process.env['SESSION_PASSWORD']!,
  cookieName: 'remotty-session',
  cookieOptions: {
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}

/** Use in Server Components and Route Handlers (App Router) */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}

/** Returns session data or null; never throws */
export async function requireAuth(): Promise<SessionData | null> {
  const session = await getSession()
  if (!session.userId) return null
  return { userId: session.userId, username: session.username }
}

/** Extract iron-session data from a raw HTTP upgrade request (WS context).
 *  Uses `unsealData` directly since `next/headers` is unavailable in WS handlers.
 */
export async function getSessionFromWsRequest(req: IncomingMessage): Promise<SessionData | null> {
  const cookieHeader = req.headers['cookie'] ?? ''
  const cookieMap: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) cookieMap[k.trim()] = decodeURIComponent(v.join('=').trim())
  }
  const sealed = cookieMap['remotty-session']
  if (!sealed) return null
  try {
    return await unsealData<SessionData>(sealed, { password: process.env['SESSION_PASSWORD']! })
  } catch {
    return null
  }
}
