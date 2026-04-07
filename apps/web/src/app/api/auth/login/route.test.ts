import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUserFindUnique = vi.fn()

// Mock the db module
vi.mock('@/server/db', () => ({
  getDb: vi.fn().mockReturnValue({
    user: {
      findUnique: mockUserFindUnique,
    },
  }),
}))

// Mock iron-session
vi.mock('iron-session', () => ({
  getIronSession: vi.fn().mockResolvedValue({
    userId: undefined,
    username: undefined,
    save: vi.fn(),
  }),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}))

// Mock rate-limit to always allow in tests
vi.mock('@/server/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

import { POST } from './route.js'
import { checkRateLimit } from '@/server/rate-limit'
import bcrypt from 'bcrypt'
import type { NextRequest } from 'next/server'

describe('POST /api/auth/login', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 on invalid body', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 on unknown username', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'nobody', password: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 on wrong password', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: '1', username: 'admin', passwordHash: await bcrypt.hash('correct', 12),
      role: 'ADMIN', createdAt: new Date(),
    } as never)
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 on correct credentials', async () => {
    const hash = await bcrypt.hash('correct', 12)
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1', username: 'admin', passwordHash: hash,
      role: 'ADMIN', createdAt: new Date(),
    } as never)
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'correct' }),
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false)
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(429)
  })
})
