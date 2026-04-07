import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { redirect } from 'next/navigation'
import { SpawnForm } from './SpawnForm'

export default async function NewSessionPage() {
  const auth = await requireAuth()
  if (!auth) redirect('/login')

  const [hosts, profiles] = await Promise.all([
    getDb().host.findMany({ where: { online: true }, select: { id: true, name: true } }),
    getDb().profile.findMany({ select: { id: true, name: true } }),
  ])

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-14 bg-surface-container flex flex-col items-center py-8 gap-6 border-r border-outline-variant/10">
        <span className="text-[10px] font-headline font-black text-primary tracking-tighter">R</span>
        <nav className="flex flex-col gap-4 mt-4">
          {['dashboard', 'terminal', 'dns', 'menu_book'].map((icon) => (
            <span key={icon} className="material-symbols-outlined text-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
              {icon}
            </span>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-8 max-w-2xl">
        <h1 className="text-4xl font-headline font-bold tracking-tighter mb-2">
          New <span className="text-primary">Session</span>
        </h1>
        <p className="text-sm text-on-surface-variant mb-8">Spawn a coding agent on a connected host</p>

        {hosts.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
            <p className="text-sm text-on-surface-variant font-mono">No hosts online. Start the daemon and wait for it to connect.</p>
          </div>
        ) : (
          <SpawnForm hosts={hosts} profiles={profiles} />
        )}
      </main>
    </div>
  )
}
