'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Profile {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  cwd: string | null
  createdAt: string
}

function ProfileForm({
  profile,
  onSave,
  onCancel,
}: {
  profile?: Profile
  onSave: (data: { name: string; command: string; args: string[]; env: Record<string, string>; cwd: string | null }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(profile?.name ?? '')
  const [command, setCommand] = useState(profile?.command ?? 'claude')
  const [args, setArgs] = useState((profile?.args ?? []).join(' '))
  const [cwd, setCwd] = useState(profile?.cwd ?? '')
  const [envEntries, setEnvEntries] = useState(
    Object.entries(profile?.env ?? {}).map(([key, value]) => ({ key, value })),
  )

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    const env: Record<string, string> = {}
    for (const { key, value } of envEntries) {
      if (key.trim()) env[key.trim()] = value
    }
    onSave({
      name: name.trim(),
      command: command.trim(),
      args: args.trim().split(/\s+/).filter(Boolean),
      env,
      cwd: cwd.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">Profile Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value) }}
          placeholder="Claude Code (OpenRouter)"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 px-4 text-on-surface font-mono text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">Command</label>
        <input
          type="text"
          value={command}
          onChange={(e) => { setCommand(e.target.value) }}
          placeholder="claude"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 px-4 text-on-surface font-mono text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">Arguments (space-separated)</label>
        <input
          type="text"
          value={args}
          onChange={(e) => { setArgs(e.target.value) }}
          placeholder="--dangerously-skip-permissions"
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 px-4 text-on-surface font-mono text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">Working Directory (optional)</label>
        <input
          type="text"
          value={cwd}
          onChange={(e) => { setCwd(e.target.value) }}
          placeholder="/home/user/projects"
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 px-4 text-on-surface font-mono text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-widest text-on-surface-variant mb-2">Environment Variables</label>
        <div className="space-y-2">
          {envEntries.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={entry.key}
                onChange={(e) => {
                  const next = [...envEntries]
                  next[i] = { ...entry, key: e.target.value }
                  setEnvEntries(next)
                }}
                placeholder="ANTHROPIC_API_KEY"
                className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-2 px-3 text-on-surface font-mono text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              />
              <span className="text-on-surface-variant self-center">=</span>
              <input
                type="text"
                value={entry.value}
                onChange={(e) => {
                  const next = [...envEntries]
                  next[i] = { ...entry, value: e.target.value }
                  setEnvEntries(next)
                }}
                placeholder="sk-..."
                className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-2 px-3 text-on-surface font-mono text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              />
              <button
                type="button"
                onClick={() => { setEnvEntries(envEntries.filter((_, j) => j !== i)) }}
                className="text-on-surface-variant hover:text-error p-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setEnvEntries([...envEntries, { key: '', value: '' }]) }}
          className="mt-2 text-xs text-primary uppercase tracking-widest flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-xs">add</span> Add Variable
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-lg text-xs uppercase tracking-widest py-3 font-bold"
        >
          {profile ? 'Save Changes' : 'Create Profile'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 border border-outline-variant/30 text-on-surface-variant rounded-lg text-xs uppercase tracking-widest py-3 hover:border-primary/30 hover:text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function ProfilesPage({ profiles: initialProfiles, isAdmin }: { profiles: Profile[]; isAdmin: boolean }) {
  const router = useRouter()
  const [profiles, setProfiles] = useState(initialProfiles)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSave(data: { name: string; command: string; args: string[]; env: Record<string, string>; cwd: string | null }) {
    setError(null)
    const url = editing ? `/api/profiles/${editing.id}` : '/api/profiles'
    const method = editing ? 'PUT' : 'POST'
    void fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((res) => {
      if (res.ok) {
        setEditing(null)
        setCreating(false)
        router.refresh()
        void fetch('/api/profiles').then((r) => r.json() as Promise<Profile[]>).then((updated) => {
          setProfiles(updated)
        })
      } else {
        void res.json().then((body) => {
          setError((body as { error?: string }).error ?? 'Failed to save profile')
        })
      }
    })
  }

  function handleDelete(id: string) {
    setDeleting(id)
    void fetch(`/api/profiles/${id}`, { method: 'DELETE' }).then(() => {
      setDeleting(null)
      setProfiles(profiles.filter((p) => p.id !== id))
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
          <Link href="/profiles" className="text-primary">
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
              Profiles <span className="text-primary">({profiles.length})</span>
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">Agent command templates</p>
          </div>
          <button
            onClick={() => { setCreating(true); setEditing(null) }}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-lg text-xs uppercase tracking-widest py-2.5 px-4 font-bold"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            New Profile
          </button>
        </header>

        <div className="p-8">
          {(creating || editing) && (
            <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
              <h2 className="text-xl font-headline font-bold text-on-surface mb-6 tracking-tight">
                {editing ? 'Edit Profile' : 'New Profile'}
              </h2>
              {error && <p className="text-xs text-error font-mono mb-4">{error}</p>}
              <ProfileForm
                profile={editing ?? undefined}
                onSave={handleSave}
                onCancel={() => { setCreating(false); setEditing(null); setError(null) }}
              />
            </div>
          )}

          <div className="grid gap-4">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10 hover:border-primary/20 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-headline font-bold text-on-surface">{profile.name}</h3>
                    </div>
                    <p className="font-mono text-xs text-on-surface-variant">
                      <span className="text-primary">{profile.command}</span>
                      {profile.args.length > 0 && ` ${profile.args.join(' ')}`}
                    </p>
                    {Object.keys(profile.env).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(profile.env).map(([key]) => (
                          <span key={key} className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded text-tertiary">
                            {key}=***
                          </span>
                        ))}
                      </div>
                    )}
                    {profile.cwd && (
                      <p className="font-mono text-xs text-on-surface-variant mt-1">
                        cwd: {profile.cwd}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(profile); setCreating(false); setError(null) }}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 rounded-lg text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                      Edit
                    </button>
                    <button
                      onClick={() => { handleDelete(profile.id) }}
                      disabled={deleting === profile.id}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 rounded-lg text-error border border-error/30 hover:bg-error/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                      {deleting === profile.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
