import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { createAuditLog } from '@/server/audit-log'

const ProfileBody = z.object({
  name: z.string().min(1).max(100),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  cwd: z.string().optional(),
})

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admins see all; regular users see all (profiles are shareable) or owned
  const profiles = await getDb().profile.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      command: true,
      args: true,
      env: true,
      cwd: true,
      createdAt: true,
      ownerId: true,
    },
  })
  return NextResponse.json(profiles)
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json()
  const parsed = ProfileBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })

  const existing = await getDb().profile.findUnique({ where: { name: parsed.data.name } })
  if (existing) return NextResponse.json({ error: 'Profile name already exists' }, { status: 409 })

  // Set ownerId to current user (admins may want to create org-wide profiles)
  const profile = await getDb().profile.create({
    data: {
      ...parsed.data,
      ownerId: auth.userId ?? undefined,
    },
  })

  await createAuditLog({
    user: auth,
    action: 'profile.create',
    resource: `profile:${profile.id}`,
    details: { name: profile.name },
  })

  return NextResponse.json(profile, { status: 201 })
}
