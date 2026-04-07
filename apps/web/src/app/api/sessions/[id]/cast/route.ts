import { NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  const session = await getDb().session.findUnique({
    where: { id: sessionId },
    include: { profile: true, host: true },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.userId !== auth.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const events = await getDb().sessionEvent.findMany({
    where: { sessionId },
    orderBy: { id: 'asc' },
  })

  // Build asciinema cast format: [timestamp, type, data]
  // Timestamp is seconds relative to session start
  const startMs = session.startedAt.getTime()
  const cast: (number | string)[][] = []

  for (const event of events) {
    if (event.kind === 'stdout') {
      const ts = (event.ts.getTime() - startMs) / 1000
      const text = Buffer.from(event.data).toString('utf8')
      // Split by newlines to create separate events per line for better seeking
      for (const line of text.split('\n')) {
        if (line) {
          cast.push([Math.round(ts * 100) / 100, 'o', line + '\n'])
        }
      }
    }
  }

  // asciinema header
  const header = {
    version: 2,
    width: 220,
    height: 50,
    timestamp: Math.floor(startMs / 1000),
    env: { TERM: 'xterm-256color', SHELL: '/bin/bash' },
    title: `${session.profile.name} on ${session.host.name}`,
  }

  const castJson = JSON.stringify([header, ...cast])

  return new NextResponse(castJson, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="session-${sessionId.slice(0, 8)}.cast"`,
    },
  })
}
