import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { spawnOnDaemon } from '@/server/ws/host-hub'

const CreateSessionBody = z.object({
  hostId: z.string().min(1),
  profileId: z.string().min(1),
  cols: z.number().int().positive().default(220),
  rows: z.number().int().positive().default(50),
})

export async function POST(req: Request): Promise<NextResponse> {
  const authSession = await requireAuth()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json()
  const parsed = CreateSessionBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { hostId, profileId, cols, rows } = parsed.data

  // Verify host is online
  const host = await db.host.findUnique({ where: { id: hostId } })
  if (!host?.online) return NextResponse.json({ error: 'Host not available' }, { status: 409 })

  const profile = await db.profile.findUnique({ where: { id: profileId } })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Create session record
  const session = await db.session.create({
    data: {
      hostId,
      profileId,
      userId: authSession.userId!,
      status: 'PENDING',
    },
  })

  // Send spawn command to daemon via host-hub
  const daemonWs = spawnOnDaemon(session.id, {
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
    await db.session.update({ where: { id: session.id }, data: { status: 'ERROR' } })
    return NextResponse.json({ error: 'No daemon available for this host' }, { status: 503 })
  }

  // Optimistically mark as RUNNING
  await db.session.update({ where: { id: session.id }, data: { status: 'RUNNING' } })

  return NextResponse.json({ sessionId: session.id })
}
