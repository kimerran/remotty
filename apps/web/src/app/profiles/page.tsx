import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { redirect } from 'next/navigation'
import { ProfilesPage } from './ProfilesPage'

export default async function ProfilesPageServer() {
  const auth = await requireAuth()
  if (!auth) redirect('/login')

  const profiles = await getDb().profile.findMany({ orderBy: { createdAt: 'desc' } })
  const user = await getDb().user.findUnique({ where: { id: auth.userId } })

  // Serialize dates for client component
  const serializedProfiles = profiles.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    env: (p.env as unknown as Record<string, string>),
  }))

  return <ProfilesPage profiles={serializedProfiles} isAdmin={user?.role === 'ADMIN'} />
}
