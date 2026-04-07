import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { createAuditLog } from '@/server/audit-log'
import type { AccessType } from '@prisma/client'

const ShareBody = z.object({
  userId: z.string().min(1),
  accessType: z.enum(['READ', 'WRITE']).default('READ'),
})

// GET /api/sessions/[id]/access — list who has access
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  // Get session and check access
  const session = await getDb().session.findUnique({
    where: { id: sessionId },
    include: {
      accessList: {
        include: { user: { select: { id: true, username: true } } },
      },
    },
  })

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // ACL: must be owner, admin, or have explicit access
  const hasAccess =
    auth.role === 'ADMIN' ||
    session.userId === auth.userId ||
    session.accessList.some((a) => a.userId === auth.userId)

  if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  return NextResponse.json({
    sessionId,
    ownerId: session.userId,
    accessList: session.accessList.map((a) => ({
      userId: a.userId,
      username: a.user.username,
      accessType: a.accessType,
    })),
  })
}

// POST /api/sessions/[id]/access — share with a user
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  const body: unknown = await req.json()
  const parsed = ShareBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { userId: targetUserId, accessType } = parsed.data

  // Get session
  const session = await getDb().session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // ACL: only owner or admin can share
  if (auth.role !== 'ADMIN' && session.userId !== auth.userId) {
    return NextResponse.json({ error: 'Only the session owner can share' }, { status: 403 })
  }

  // Verify target user exists
  const targetUser = await getDb().user.findUnique({ where: { id: targetUserId } })
  if (!targetUser) return NextResponse.json({ error: 'Target user not found' }, { status: 404 })

  // Cannot share with yourself
  if (targetUserId === auth.userId) {
    return NextResponse.json({ error: 'Cannot share with yourself' }, { status: 400 })
  }

  // Upsert access
  await getDb().sessionAccess.upsert({
    where: { sessionId_userId: { sessionId, userId: targetUserId } },
    create: { sessionId, userId: targetUserId, accessType: accessType as AccessType },
    update: { accessType: accessType as AccessType },
  })

  await createAuditLog({
    user: auth,
    action: 'session.share',
    resource: `session:${sessionId}`,
    details: { sharedWith: targetUserId, username: targetUser.username, accessType },
  })

  return NextResponse.json({ success: true })
}
