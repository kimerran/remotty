import { NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { createAuditLog } from '@/server/audit-log'

// DELETE /api/sessions/[id]/access/[userId] — revoke shared access
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId, userId: targetUserId } = await params

  const session = await getDb().session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // ACL: only owner or admin can unshare
  if (auth.role !== 'ADMIN' && session.userId !== auth.userId) {
    return NextResponse.json({ error: 'Only the session owner can revoke access' }, { status: 403 })
  }

  await getDb().sessionAccess.deleteMany({
    where: { sessionId, userId: targetUserId },
  })

  await createAuditLog({
    user: auth,
    action: 'session.unshare',
    resource: `session:${sessionId}`,
    details: { revokedFrom: targetUserId },
  })

  return NextResponse.json({ success: true })
}
