'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/StatusBadge'

type BadgeStatus = 'running' | 'completed' | 'errored' | 'pending' | 'exited'

interface Session {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  exitCode: number | null
  host: { id: string; name: string; online: boolean }
  profile: { id: string; name: string; command: string }
}

function toBadgeStatus(s: string): BadgeStatus {
  switch (s) {
    case 'RUNNING': return 'running'
    case 'EXITED': return 'exited'
    case 'ERROR': return 'errored'
    case 'PENDING': return 'pending'
    default: return 'pending'
  }
}

function formatDuration(start: string, end: string | null): string {
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  const secs = Math.floor((endMs - startMs) / 1000)
  if (secs < 60) return `${String(secs)}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${String(mins)}m ${String(secs % 60)}s`
  const hours = Math.floor(mins / 60)
  return `${String(hours)}h ${String(mins % 60)}m`
}

export function SessionsDashboard({ sessions, isAdmin }: { sessions: Session[]; isAdmin: boolean }) {
  const router = useRouter()
  const [filter, setFilter] = useState('ALL')
  const [killing, setKilling] = useState<string | null>(null)

  const filtered = filter === 'ALL' ? sessions : sessions.filter((s) => s.status === filter)

  async function handleKill(sessionId: string) {
    setKilling(sessionId)
    await fetch(`/api/sessions/${sessionId}/kill`, { method: 'POST' })
    setKilling(null)
    router.refresh()
  }

  async function handleRestart(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}/restart`, { method: 'POST' })
    if (res.ok) {
      const data = (await res.json()) as { sessionId: string }
      router.push(`/sessions/${data.sessionId}`)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-14 bg-surface-container flex flex-col items-center py-8 gap-6 border-r border-outline-variant/10">
        <span className="text-[10px] font-headline font-black text-primary tracking-tighter">R</span>
        <nav className="flex flex-col gap-4">
          <Link href="/sessions" className="text-primary">
            <span className="material-symbols-outlined text-lg">dashboard</span>
          </Link>
          <Link href="/sessions/new" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">add_circle</span>
          </Link>
          <Link href="/profiles" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">tune</span>
          </Link>
          {isAdmin && (
            <Link href="/admin/hosts" className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-lg">dns</span>
            </Link>
          )}
        </nav>
        <div className="mt-auto">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-on-surface-variant hover:text-primary p-1">
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between px-8 py-6 border-b border-outline-variant/10">
          <div>
            <h1 className="text-4xl font-headline font-bold tracking-tighter">
              Sessions <span className="text-primary">({sessions.length})</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {['ALL', 'RUNNING', 'PENDING', 'EXITED', 'ERROR'].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f) }}
                className={`text-xs uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors ${
                  filter === f
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {f}
              </button>
            ))}
            <Link href="/sessions/new">
              <button className="ml-4 inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-lg text-xs uppercase tracking-widest py-2.5 px-4 font-bold">
                <span className="material-symbols-outlined text-sm">add</span>
                New
              </button>
            </Link>
          </div>
        </header>

        <div className="p-8">
          {filtered.length === 0 ? (
            <div className="bg-surface-container-low rounded-xl p-12 border border-outline-variant/10 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">terminal</span>
              <p className="text-on-surface-variant font-mono text-sm">No sessions found</p>
              <Link href="/sessions/new" className="inline-block mt-4 text-primary text-xs uppercase tracking-widest">
                Spawn your first session →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((session) => (
                <div
                  key={session.id}
                  className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10 hover:border-primary/20 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <StatusBadge status={toBadgeStatus(session.status)} />
                      <div>
                        <p className="font-mono text-sm text-on-surface font-semibold">
                          {session.profile.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">computer</span>
                            {session.host.name}
                          </span>
                          <span className="text-xs text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            {formatDuration(session.startedAt, session.endedAt)}
                          </span>
                          {session.exitCode !== null && (
                            <span className="text-xs text-on-surface-variant font-mono">
                              exit {session.exitCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {session.status === 'RUNNING' && (
                        <button
                          onClick={() => { void handleKill(session.id) }}
                          disabled={killing === session.id}
                          className="inline-flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 rounded-lg text-error border border-error/30 hover:bg-error/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">stop</span>
                          {killing === session.id ? 'Killing…' : 'Kill'}
                        </button>
                      )}
                      {(session.status === 'EXITED' || session.status === 'ERROR') && (
                        <button
                          onClick={() => { void handleRestart(session.id) }}
                          className="inline-flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 rounded-lg text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">refresh</span>
                          Restart
                        </button>
                      )}
                      <Link
                        href={`/sessions/${session.id}`}
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 rounded-lg text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xs">terminal</span>
                        {session.status === 'RUNNING' ? 'Attach' : 'View'}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
