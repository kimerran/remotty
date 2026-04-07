import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { db } from '@/server/db'
import { getSession } from '@/server/auth'
import { checkRateLimit } from '@/server/rate-limit'

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit: 5 attempts per minute per IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const allowed = await checkRateLimit(`login:${ip}`)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })
  }

  const body: unknown = await req.json()
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { username, password } = parsed.data

  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    // Constant-time response to prevent username enumeration
    await bcrypt.hash('dummy', 12)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const session = await getSession()
  session.userId = user.id
  session.username = user.username
  await session.save()

  return NextResponse.json({ ok: true })
}
