import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { redirect } from 'next/navigation'
import { SessionsDashboard } from './SessionsDashboard'

export default async function SessionsPage() {
  const auth = await requireAuth()
  if (!auth) redirect('/login')

  const sessions = await getDb().session.findMany({
    where: { userId: auth.userId ?? '' },
    include: {
      host: { select: { id: true, name: true, online: true } },
      profile: { select: { id: true, name: true, command: true } },
    },
    orderBy: { startedAt: 'desc' },
  })

  const user = await getDb().user.findUnique({ where: { id: auth.userId } })

  // Serialize dates for client component
  const serializedSessions = sessions.map((s) => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
  }))

  return <SessionsDashboard sessions={serializedSessions} isAdmin={user?.role === 'ADMIN'} />
}
