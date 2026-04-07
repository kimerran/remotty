import { requireAuth } from '@/server/auth'
import { getDb } from '@/server/db'
import { redirect, notFound } from 'next/navigation'
import { Terminal } from './Terminal'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth) redirect('/login')

  const { id } = await params
  const session = await getDb().session.findUnique({
    where: { id },
    include: { host: true, profile: true },
  })

  if (!session || session.userId !== auth.userId) notFound()

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

      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">{id.slice(0, 12)}…</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
              session.status === 'RUNNING' ? 'bg-tertiary/10 text-tertiary' :
              session.status === 'EXITED' ? 'bg-primary/10 text-primary' :
              'bg-error/10 text-error'
            }`}>
              {session.status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />}
              {session.status}
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {session.host.name} · {session.profile.name}
            </span>
          </div>
          <form action={`/api/sessions/${id}/kill`} method="POST">
            <button
              type="submit"
              className="text-on-surface-variant hover:text-error transition-colors p-1"
              aria-label="Kill session"
              disabled={session.status !== 'RUNNING' && session.status !== 'PENDING'}
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </form>
        </header>

        <main className="flex-1 overflow-hidden">
          <Terminal sessionId={id} />
        </main>
      </div>
    </div>
  )
}
