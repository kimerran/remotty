'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'

interface Host { id: string; name: string }
interface Profile { id: string; name: string }

export function SpawnForm({ hosts, profiles }: { hosts: Host[]; profiles: Profile[] }) {
  const [hostId, setHostId] = useState(hosts[0]?.id ?? '')
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId, profileId }),
    })

    if (res.ok) {
      const data = (await res.json()) as { sessionId: string }
      router.push(`/sessions/${data.sessionId}`)
    } else {
      const data = (await res.json()) as { error?: string }
      setError(data.error ?? 'Failed to spawn session')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">Host</h3>
        <p className="text-sm text-on-surface-variant mb-3">Where the agent will run</p>
        <div className="relative">
          <select
            value={hostId}
            onChange={(e) => setHostId(e.target.value)}
            className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
          >
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-on-surface font-headline tracking-tight">Profile</h3>
        <p className="text-sm text-on-surface-variant mb-3">Agent command + environment</p>
        <div className="relative">
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
        </div>
      </div>

      {error && <p className="text-xs text-error font-mono">{error}</p>}

      <button
        type="submit"
        disabled={loading || !hostId || !profileId}
        className="group relative w-full overflow-hidden bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed rounded-xl py-6 font-headline font-black text-2xl tracking-tighter uppercase active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
      >
        <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Icon name="rocket_launch" className="text-3xl group-hover:translate-x-2 transition-transform" />
        {loading ? 'Spawning…' : 'Spawn Agent Session'}
      </button>
    </form>
  )
}
