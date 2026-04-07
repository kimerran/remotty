import { NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') ?? ''

  const session = await getDb().session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.userId !== auth.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!query.trim()) {
    return NextResponse.json({ results: [], total: 0 })
  }

  // Search session events by decoding stdout chunks and matching against query
  const events = await getDb().sessionEvent.findMany({
    where: { sessionId },
    orderBy: { id: 'asc' },
  })

  const results: { eventId: bigint; ts: Date; snippet: string }[] = []
  const queryLower = query.toLowerCase()

  for (const event of events) {
    if (event.kind === 'stdout') {
      const text = Buffer.from(event.data).toString('utf8')
      const idx = text.toLowerCase().indexOf(queryLower)
      if (idx !== -1) {
        // Extract surrounding context (50 chars before and after)
        const start = Math.max(0, idx - 50)
        const end = Math.min(text.length, idx + query.length + 50)
        const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
        results.push({ eventId: event.id, ts: event.ts, snippet })
      }
    }
  }

  return NextResponse.json({ results: results.slice(0, 100), total: results.length })
}
