import { Prisma } from '@prisma/client'
import { getDb } from '@/server/db'
import type { SessionData } from '@/server/auth'

export type AuditAction =
  | 'session.create'
  | 'session.kill'
  | 'session.restart'
  | 'session.view'
  | 'host.register'
  | 'host.delete'
  | 'profile.create'
  | 'profile.update'
  | 'profile.delete'
  | 'session.share'
  | 'session.unshare'
  | 'user.login'
  | 'user.logout'

export async function createAuditLog(params: {
  user: SessionData
  action: AuditAction
  resource: string
  details?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  if (!params.user.userId) return

  try {
    const db = getDb()
    await db.auditLog.create({
      data: {
        userId: params.user.userId,
        action: params.action,
        resource: params.resource,
        details: params.details ? (JSON.parse(JSON.stringify(params.details)) as Prisma.InputJsonValue) : undefined,
        ipAddress: params.ipAddress,
      },
    })
  } catch (err) {
    // Audit log failures should not break the main operation
    console.error('[audit] failed to write audit log:', err)
  }
}
