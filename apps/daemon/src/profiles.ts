// Builds a safe env for PTY spawn — strips parent process env,
// injects only what the profile explicitly declares.
export function buildSafeEnv(profileEnv: Record<string, string>): Record<string, string> {
  return {
    PATH: process.env['PATH'] ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: process.env['HOME'] ?? '/root',
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    ...profileEnv,
  }
}
