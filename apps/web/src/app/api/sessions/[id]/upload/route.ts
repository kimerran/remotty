import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { getUploadUrl, buildSessionFileKey } from '@/server/s3'

const UploadBody = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(100 * 1024 * 1024), // 100MB
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params
  const session = await getDb().session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.userId !== auth.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: unknown = await req.json()
  const parsed = UploadBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { filename, contentType, size } = parsed.data
  const key = buildSessionFileKey(sessionId, filename)

  try {
    const { uploadUrl } = await getUploadUrl(key, contentType, size)
    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    console.error('[upload] failed to generate upload URL:', err)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
