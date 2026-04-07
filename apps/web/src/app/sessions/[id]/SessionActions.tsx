'use client'
import { useRouter } from 'next/navigation'

interface SessionActionsProps {
  sessionId: string
  sessionStatus: string
}

export function SessionActions({ sessionId, sessionStatus }: SessionActionsProps) {
  const router = useRouter()
  const isAlive = sessionStatus === 'RUNNING' || sessionStatus === 'PENDING'

  return (
    <div className="flex items-center gap-1">
      {isAlive && (
        <button
          onClick={() => { void fetch(`/api/sessions/${sessionId}/kill`, { method: 'POST' }).then(() => { router.refresh() }) }}
          className="text-on-surface-variant hover:text-error transition-colors p-1"
          aria-label="Kill session"
        >
          <span className="material-symbols-outlined text-lg">stop</span>
        </button>
      )}
      {(sessionStatus === 'EXITED' || sessionStatus === 'ERROR') && (
        <button
          onClick={() => {
            void fetch(`/api/sessions/${sessionId}/restart`, { method: 'POST' })
              .then((res) => { if (res.ok) { void res.json().then((data: { sessionId: string }) => { router.push(`/sessions/${data.sessionId}`) }) } })
          }}
          className="text-on-surface-variant hover:text-primary transition-colors p-1"
          aria-label="Restart session"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
        </button>
      )}
      <button
        onClick={() => { window.location.href = `/api/sessions/${sessionId}/cast` }}
        className="text-on-surface-variant hover:text-primary transition-colors p-1"
        aria-label="Download session log"
        title="Download .cast"
      >
        <span className="material-symbols-outlined text-lg">download</span>
      </button>
    </div>
  )
}
