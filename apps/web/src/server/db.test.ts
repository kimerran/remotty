import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb } from './db.js'
const db = getDb()

// These tests require a real database. Run: docker compose up -d
// then: DATABASE_URL=postgresql://orch:orch@localhost:5432/orch pnpm test

describe('seed data', () => {
  beforeAll(async () => {
    await db.$connect()
  })

  afterAll(async () => {
    await db.$disconnect()
  })

  it('admin user exists', async () => {
    const username = process.env['ADMIN_USERNAME'] ?? 'admin'
    const user = await db.user.findUnique({ where: { username } })
    expect(user).not.toBeNull()
    expect(user?.role).toBe('ADMIN')
    expect(user?.passwordHash).toMatch(/^\$2[ab]\$/) // must be a bcrypt hash
    expect(user?.passwordHash).not.toBe(process.env['ADMIN_PASSWORD']) // must not be plaintext
  })

  it('default Claude Code profile exists', async () => {
    const profile = await db.profile.findUnique({ where: { name: 'Claude Code (native)' } })
    expect(profile).not.toBeNull()
    expect(profile?.command).toBe('claude')
    expect(profile?.args).toContain('--dangerously-skip-permissions')
  })

  it('default local-dev host exists', async () => {
    const host = await db.host.findUnique({ where: { name: 'local-dev' } })
    expect(host).not.toBeNull()
    expect(host?.token).not.toBe(process.env['DEFAULT_HOST_TOKEN'])
  })
})
