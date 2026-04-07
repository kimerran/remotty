import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline font-black text-2xl text-primary tracking-tighter">Remotty v1.0</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-on-surface-variant mt-1">Agent Orchestrator</p>
        </div>
        <div className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/10">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
