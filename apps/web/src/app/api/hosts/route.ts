import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { createAuditLog } from '@/server/audit-log'

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admins see all hosts; regular users see only their own
  const where: Prisma.HostWhereInput = auth.role === 'ADMIN' ? {} : { ownerId: auth.userId }

  const hosts = await getDb().host.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      online: true,
      lastSeenAt: true,
      createdAt: true,
      ownerId: true,
      _count: { select: { sessions: true } },
    },
  })
  return NextResponse.json(hosts)
}

const RegisterHostBody = z.object({
  name: z.string().min(1).max(100),
})

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: unknown = await req.json()
  const parsed = RegisterHostBody.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const existing = await getDb().host.findUnique({ where: { name: parsed.data.name } })
  if (existing) return NextResponse.json({ error: 'Host name already exists' }, { status: 409 })

  // Generate a secure random token (32 bytes, hex = 64 chars)
  const rawToken = randomBytes(32).toString('hex')
  const hashedToken = await bcrypt.hash(rawToken, 12)

  const host = await getDb().host.create({
    data: { name: parsed.data.name, token: hashedToken },
    select: { id: true, name: true },
  })

  await createAuditLog({
    user: auth,
    action: 'host.register',
    resource: `host:${host.id}`,
    details: { name: host.name },
  })

  // Return the raw token only to the admin — it's never stored in plain text
  return NextResponse.json({ ...host, token: rawToken }, { status: 201 })
}
