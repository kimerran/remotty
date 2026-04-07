import { Terminal } from './Terminal'

// In Phase 4 the sessionId comes from the URL and we don't validate it against
// the DB yet. That validation is added in Task 9 when Prisma is wired in.
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="flex h-screen bg-background">
      {/* Collapsed icon sidebar */}
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
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">{id}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/10 text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              Running
            </span>
          </div>
          <button
            className="text-on-surface-variant hover:text-error transition-colors p-1"
            aria-label="Kill session"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </header>

        {/* Terminal fills remaining height */}
        <main className="flex-1 overflow-hidden">
          <Terminal sessionId={id} />
        </main>
      </div>
    </div>
  )
}
