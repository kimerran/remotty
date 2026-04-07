'use client'

import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { xtermTheme } from '@/lib/xterm-theme'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string
}

export function Terminal({ sessionId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      theme: xtermTheme,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${location.host}/ws/client?sessionId=${sessionId}`)
    ws.binaryType = 'arraybuffer'

    ws.onmessage = (e) => {
      try {
        const msg: unknown = JSON.parse(
          typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer),
        )
        if (
          msg !== null &&
          typeof msg === 'object' &&
          'type' in msg &&
          (msg as Record<string, unknown>)['type'] === 'session.stdout' &&
          'data' in msg
        ) {
          const data = (msg as Record<string, unknown>)['data'] as string
          term.write(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)))
        }
      } catch {
        // ignore malformed messages
      }
    }

    term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'session.stdin', sessionId, data: btoa(d) }))
      }
    })

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'session.resize', sessionId, cols: term.cols, rows: term.rows }))
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ws.close()
      term.dispose()
      ro.disconnect()
    }
  }, [sessionId])

  return <div ref={containerRef} className="h-full w-full bg-surface-container-lowest" />
}
