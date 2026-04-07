import { NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { db } from '@/server/db'
import { sessionRouter } from '@/server/session-router'
import { WebSocket } from 'ws'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authSession = await requireAuth()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  const session = await db.session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.userId !== authSession.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const daemonWs = sessionRouter.getHostWs(sessionId)
  if (daemonWs?.readyState === WebSocket.OPEN) {
    daemonWs.send(JSON.stringify({ type: 'session.kill', sessionId, signal: 'SIGTERM' }))
  }

  await db.session.update({
    where: { id: sessionId },
    data: { status: 'EXITED', endedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
