import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { redirect } from 'next/navigation'
import { HostsPage } from './HostsPage'

export default async function HostsPageServer() {
  const auth = await requireAuth()
  if (!auth) redirect('/login')

  const user = await getDb().user.findUnique({ where: { id: auth.userId } })
  if (user?.role !== 'ADMIN') redirect('/sessions')

  const hosts = await getDb().host.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { sessions: true } } },
  })

  // Serialize dates for client component
  const serialized = hosts.map((h) => ({
    ...h,
    lastSeenAt: h.lastSeenAt?.toISOString() ?? null,
    createdAt: h.createdAt.toISOString(),
  }))

  return <HostsPage hosts={serialized} />
}
