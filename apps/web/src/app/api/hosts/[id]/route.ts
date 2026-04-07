import { NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { createAuditLog } from '@/server/audit-log'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const host = await getDb().host.findUnique({ where: { id } })
  if (!host) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await getDb().host.delete({ where: { id } })

  await createAuditLog({
    user: auth,
    action: 'host.delete',
    resource: `host:${id}`,
    details: { name: host.name },
  })

  return NextResponse.json({ ok: true })
}
