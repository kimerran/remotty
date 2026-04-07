import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { spawnOnDaemon } from '@/server/ws/host-hub'
import { createAuditLog } from '@/server/audit-log'

const CreateSessionBody = z.object({
  hostId: z.string().min(1),
  profileId: z.string().min(1),
  cols: z.number().int().positive().default(220),
  rows: z.number().int().positive().default(50),
})

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const hostId = searchParams.get('hostId')

  // Admins see all sessions; regular users see own + shared
  if (auth.role === 'ADMIN' && searchParams.get('all') === '1') {
    const where: Record<string, unknown> = {}
    if (status) where['status'] = status
    if (hostId) where['hostId'] = hostId
    const sessions = await getDb().session.findMany({
      where,
      include: {
        host: { select: { id: true, name: true, online: true } },
        profile: { select: { id: true, name: true, command: true } },
      },
      orderBy: { startedAt: 'desc' },
    })
    return NextResponse.json(sessions)
  }

  const where: Record<string, unknown> = {
    OR: [
      { userId: auth.userId ?? '' },
      { accessList: { some: { userId: auth.userId } } },
    ],
  }
  if (status) where['status'] = status
  if (hostId) where['hostId'] = hostId

  const sessions = await getDb().session.findMany({
    where,
    include: {
      host: { select: { id: true, name: true, online: true } },
      profile: { select: { id: true, name: true, command: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  return NextResponse.json(sessions)
}

export async function POST(req: Request): Promise<NextResponse> {
  const authSession = await requireAuth()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json()
  const parsed = CreateSessionBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { hostId, profileId, cols, rows } = parsed.data

  // Verify host is online and accessible
  const host = await getDb().host.findUnique({ where: { id: hostId } })
  if (!host?.online) return NextResponse.json({ error: 'Host not available' }, { status: 409 })

  // Check ACL: admins can use any host, regular users must own it
  if (authSession.role !== 'ADMIN' && host.ownerId && host.ownerId !== authSession.userId) {
    return NextResponse.json({ error: 'Access denied to this host' }, { status: 403 })
  }

  const profile = await getDb().profile.findUnique({ where: { id: profileId } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Check ACL for profile
  if (authSession.role !== 'ADMIN' && profile.ownerId && profile.ownerId !== authSession.userId) {
    return NextResponse.json({ error: 'Access denied to this profile' }, { status: 403 })
  }

  // Create session record
  const session = await getDb().session.create({
    data: {
      hostId,
      profileId,
      userId: authSession.userId ?? '',
      status: 'PENDING',
    },
  })

  // Audit log
  await createAuditLog({
    user: authSession,
    action: 'session.create',
    resource: `session:${session.id}`,
    details: { hostId, profileId },
  })

  // Send spawn command to daemon via host-hub
  const daemonWs = spawnOnDaemon(session.id, hostId, {
    type: 'session.spawn',
    sessionId: session.id,
    command: profile.command,
    args: profile.args,
    env: profile.env as Record<string, string>,
    cwd: profile.cwd ?? undefined,
    cols,
    rows,
  })

  if (!daemonWs) {
    await getDb().session.update({ where: { id: session.id }, data: { status: 'ERROR' } })
    return NextResponse.json({ error: 'No daemon available for this host' }, { status: 503 })
  }

  // Optimistically mark as RUNNING before daemon confirms. If the process fails to exec,
  // the daemon will send session.exit and the status will be corrected then.
  await getDb().session.update({ where: { id: session.id }, data: { status: 'RUNNING' } })

  return NextResponse.json({ sessionId: session.id })
}
