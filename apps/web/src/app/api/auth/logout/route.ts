import { NextResponse } from 'next/server'
import { getSession } from '@/server/auth'
import { createAuditLog } from '@/server/audit-log'

export async function POST(): Promise<NextResponse> {
  const session = await getSession()
  const userData = { userId: session.userId, username: session.username, role: session.role }
  session.destroy()

  if (userData.userId) {
    await createAuditLog({
      user: userData,
      action: 'user.logout',
      resource: `user:${userData.userId}`,
    })
  }

  return NextResponse.json({ ok: true })
}
