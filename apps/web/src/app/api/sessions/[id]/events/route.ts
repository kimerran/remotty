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

  const session = await getDb().session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.userId !== auth.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const events = await getDb().sessionEvent.findMany({
    where: { sessionId },
    orderBy: { id: 'asc' },
    select: { kind: true, data: true },
  })

  // Return base64-encoded data for binary chunks
  return NextResponse.json(
    events.map((e) => ({
      kind: e.kind,
      data: Buffer.from(e.data).toString('base64'),
    })),
  )
}
