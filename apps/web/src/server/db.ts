import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set')
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

// Singleton pattern: prevents multiple PrismaClient instances in dev (hot reload)
export function getDb(): PrismaClient {
  if (!globalThis.prisma) {
    globalThis.prisma = createPrismaClient()
  }
  return globalThis.prisma
}
