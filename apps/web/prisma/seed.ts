import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! })
const db = new PrismaClient({ adapter })

async function main() {
  const adminUsername = process.env['ADMIN_USERNAME']
  const adminPassword = process.env['ADMIN_PASSWORD']
  const defaultHostToken = process.env['DEFAULT_HOST_TOKEN']

  if (!adminUsername || !adminPassword || !defaultHostToken) {
    throw new Error('ADMIN_USERNAME, ADMIN_PASSWORD, and DEFAULT_HOST_TOKEN are required for seeding')
  }

  const BCRYPT_COST = 12

  await db.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, BCRYPT_COST),
      role: 'ADMIN',
    },
  })

  await db.profile.upsert({
    where: { name: 'Claude Code (native)' },
    update: {},
    create: {
      name: 'Claude Code (native)',
      command: 'claude',
      args: ['--dangerously-skip-permissions'],
      env: {},
    },
  })

  await db.host.upsert({
    where: { name: 'local-dev' },
    update: {},
    create: {
      name: 'local-dev',
      token: await bcrypt.hash(defaultHostToken, BCRYPT_COST),
    },
  })

  console.info('seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
