'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Host {
  id: string
  name: string
  online: boolean
  lastSeenAt: string | null
  createdAt: string
  _count: { sessions: number }
}

function formatDate(date: string | null): string {
  if (!date) return 'Never'
  return new Date(date).toLocaleString()
}

export function HostsPage({ hosts: initialHosts }: { hosts: Host[] }) {
  const router = useRouter()
  const [hosts, setHosts] = useState(initialHosts)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function handleCreate(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(null)
    void fetch('/api/hosts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    }).then((res) => {
      if (res.ok) {
        void res.json().then((data: { token: string; name: string; id: string }) => {
          setNewToken(data.token)
          setNewName('')
          setCreating(false)
          router.refresh()
          void fetch('/api/hosts').then((r) => r.json()).then((updated: Host[]) => {
            setHosts(updated)
          })
        })
      } else {
        void res.json().then((body: { error?: string }) => {
          setError(body.error ?? 'Failed to create host')
        })
      }
    })
  }

  function handleDelete(id: string) {
    setDeleting(id)
    void fetch(`/api/hosts/${id}`, { method: 'DELETE' })
      .then(() => {
        setDeleting(null)
        router.refresh()
        setHosts(hosts.filter((h) => h.id !== id))
      })
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-14 bg-surface-container flex flex-col items-center py-8 gap-6 border-r border-outline-variant/10">
        <span className="text-[10px] font-headline font-black text-primary tracking-tighter">R</span>
        <nav className="flex flex-col gap-4">
          <Link href="/sessions" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">dashboard</span>
          </Link>
          <Link href="/sessions/new" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">add_circle</span>
          </Link>
          <Link href="/profiles" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-lg">tune</span>
          </Link>
          <Link href="/admin/hosts" className="text-primary">
            <span className="material-symbols-outlined text-lg">dns</span>
          </Link>
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
              Hosts <span className="text-primary">({hosts.length})</span>
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">Daemon host registration</p>
          </div>
          <button
            onClick={() => { setCreating(true); setError(null); setNewToken(null) }}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-lg text-xs uppercase tracking-widest py-2.5 px-4 font-bold"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Register Host
          </button>
        </header>

        <div className="p-8">
          {newToken && (
            <div className="bg-surface-container-low rounded-xl p-6 border border-tertiary/30 mb-8">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-tertiary mt-0.5">check_circle</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-on-surface mb-2">Host token generated — save it now!</p>
                  <p className="text-xs text-on-surface-variant mb-3">This token will not be shown again. Use it in the daemon&apos;s <code className="text-tertiary">HOST_TOKEN</code> env var.</p>
                  <code className="block bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4 font-mono text-xs text-tertiary break-all">
                    {newToken}
                  </code>
                  <button
                    onClick={() => { setNewToken(null) }}
                    className="mt-3 text-xs text-on-surface-variant uppercase tracking-widest"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {creating && (
            <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
              <h2 className="text-xl font-headline font-bold text-on-surface mb-4 tracking-tight">Register New Host</h2>
              {error && <p className="text-xs text-error font-mono mb-4">{error}</p>}
              <form onSubmit={handleCreate} className="flex gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value) }}
                  placeholder="e.g. production-1"
                  required
                  className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 px-4 text-on-surface font-mono text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-lg text-xs uppercase tracking-widest px-6 py-3 font-bold"
                >
                  Generate Token
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setError(null) }}
                  className="px-6 border border-outline-variant/30 text-on-surface-variant rounded-lg text-xs uppercase tracking-widest py-3 hover:border-primary/30 hover:text-primary transition-colors"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          <div className="space-y-3">
            {hosts.length === 0 ? (
              <div className="bg-surface-container-low rounded-xl p-12 border border-outline-variant/10 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">dns</span>
                <p className="text-on-surface-variant font-mono text-sm">No hosts registered</p>
              </div>
            ) : (
              hosts.map((host) => (
                <div
                  key={host.id}
                  className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10 hover:border-primary/20 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${host.online ? 'bg-tertiary animate-pulse' : 'bg-outline-variant'}`} />
                      <div>
                        <p className="font-mono text-sm text-on-surface font-semibold">{host.name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-on-surface-variant">
                            {host.online ? 'Online' : 'Offline'}
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            Last seen: {formatDate(host.lastSeenAt)}
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            {host._count.sessions} sessions
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { handleDelete(host.id) }}
                      disabled={deleting === host.id}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 rounded-lg text-error border border-error/30 hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                      {deleting === host.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
