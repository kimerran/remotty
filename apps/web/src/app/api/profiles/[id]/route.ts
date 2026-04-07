import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { createAuditLog } from '@/server/audit-log'

const UpdateProfileBody = z.object({
  name: z.string().min(1).max(100).optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const profile = await getDb().profile.findUnique({ where: { id } })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(profile)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body: unknown = await req.json()
  const parsed = UpdateProfileBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })

  const profile = await getDb().profile.findUnique({ where: { id } })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ACL: must be owner or admin
  if (auth.role !== 'ADMIN' && profile.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (parsed.data.name && parsed.data.name !== profile.name) {
    const existing = await getDb().profile.findUnique({ where: { name: parsed.data.name } })
    if (existing) return NextResponse.json({ error: 'Profile name already exists' }, { status: 409 })
  }

  // Normalize empty cwd to null so the daemon uses its own working directory
  const { cwd, ...rest } = parsed.data
  const updateData: Record<string, unknown> = { ...rest }
  if (cwd !== undefined) updateData['cwd'] = cwd === '' ? null : cwd
  const updated = await getDb().profile.update({ where: { id }, data: updateData })

  await createAuditLog({
    user: auth,
    action: 'profile.update',
    resource: `profile:${id}`,
    details: { changes: parsed.data },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const profile = await getDb().profile.findUnique({ where: { id } })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ACL: must be owner or admin
  if (auth.role !== 'ADMIN' && profile.ownerId !== auth.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  await getDb().profile.delete({ where: { id } })

  await createAuditLog({
    user: auth,
    action: 'profile.delete',
    resource: `profile:${id}`,
    details: { name: profile.name },
  })

  return NextResponse.json({ ok: true })
}
