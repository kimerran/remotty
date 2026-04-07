'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    void handleSubmitAsync(e)
  }

  async function handleSubmitAsync(e: React.SyntheticEvent<HTMLFormElement>) {
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
    })

    if (res.ok) {
      router.push('/sessions/new')
    } else {
      const data = (await res.json()) as { error?: string }
      setError(data.error ?? 'Login failed')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} method="post" className="space-y-6">
      <div>
        <label htmlFor="username" className="block text-xs font-bold text-primary font-label uppercase tracking-widest mb-3">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/40"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-bold text-primary font-label uppercase tracking-widest mb-3">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-4 px-6 text-on-surface font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/40"
        />
      </div>
      {error && (
        <p className="text-xs text-error font-mono">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed py-3 rounded-lg font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
