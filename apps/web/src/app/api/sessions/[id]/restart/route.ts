import { NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { spawnOnDaemon } from '@/server/ws/host-hub'
import { createAuditLog } from '@/server/audit-log'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authSession = await requireAuth()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  const session = await getDb().session.findUnique({
    where: { id: sessionId },
    include: { host: true, profile: true },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ACL: owner or admin can restart
  if (authSession.role !== 'ADMIN' && session.userId !== authSession.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (session.status === 'RUNNING') return NextResponse.json({ error: 'Session is already running' }, { status: 409 })
  if (!session.host.online) return NextResponse.json({ error: 'Host is offline' }, { status: 409 })

  const newSession = await getDb().session.create({
    data: {
      hostId: session.hostId,
      profileId: session.profileId,
      userId: authSession.userId ?? '',
      status: 'PENDING',
    },
  })

  const daemonWs = spawnOnDaemon(newSession.id, session.hostId, {
    type: 'session.spawn',
    sessionId: newSession.id,
    command: session.profile.command,
    args: session.profile.args,
    env: session.profile.env as Record<string, string>,
    cwd: session.profile.cwd ?? undefined,
    cols: 220,
    rows: 50,
  })

  if (!daemonWs) {
    await getDb().session.update({ where: { id: newSession.id }, data: { status: 'ERROR' } })
    return NextResponse.json({ error: 'Host daemon unavailable' }, { status: 503 })
  }

  await getDb().session.update({ where: { id: newSession.id }, data: { status: 'RUNNING' } })

  await createAuditLog({
    user: authSession,
    action: 'session.restart',
    resource: `session:${newSession.id}`,
    details: { originalSessionId: sessionId, hostId: session.hostId, profileId: session.profileId },
  })

  return NextResponse.json({ sessionId: newSession.id })
}
