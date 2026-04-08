import { getIronSession, unsealData, type SessionOptions } from 'iron-session'
import type { IncomingMessage } from 'node:http'

export interface SessionData {
  userId?: string
  username?: string
  role?: 'ADMIN' | 'USER'
}

function getSessionPassword(): string {
  const pw = process.env['SESSION_PASSWORD']
  if (!pw) throw new Error('SESSION_PASSWORD environment variable is required')
  return pw
}

export const sessionOptions: SessionOptions = {
  get password() { return getSessionPassword() },
  cookieName: 'remotty-session',
  cookieOptions: {
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
}

/** Use in Server Components and Route Handlers (App Router) */
export async function getSession() {
  const { cookies } = await import('next/headers')
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}

/** Returns session data or null; never throws */
export async function requireAuth(): Promise<SessionData | null> {
  const session = await getSession()
  if (!session.userId) return null
  return session
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
    return await unsealData<SessionData>(sealed, { password: getSessionPassword() })
  } catch {
    return null
  }
}

/** Returns session data or throws 401 */
export async function requireAuthOrThrow(): Promise<SessionData> {
  const data = await requireAuth()
  if (!data) throw new Error('Unauthorized')
  return data
}

/** Check if user is admin */
export function isAdmin(session: SessionData): boolean {
  return session.role === 'ADMIN'
}

/** ACL: Check if user can access a host */
export function canAccessHost(userId: string, role: 'ADMIN' | 'USER' | undefined, hostOwnerId: string | null | undefined): boolean {
  if (role === 'ADMIN') return true
  return userId === hostOwnerId
}

/** ACL: Check if user can access a profile */
export function canAccessProfile(userId: string, role: 'ADMIN' | 'USER' | undefined, profileOwnerId: string | null | undefined): boolean {
  if (role === 'ADMIN') return true
  return userId === profileOwnerId
}

/** ACL: Check if user can access a session (owner or explicitly shared) */
export function canAccessSession(
  userId: string,
  role: 'ADMIN' | 'USER' | undefined,
  sessionOwnerId: string,
  sessionAccessList: { userId: string }[],
): boolean {
  if (role === 'ADMIN') return true
  if (userId === sessionOwnerId) return true
  return sessionAccessList.some((a) => a.userId === userId)
}
