import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/server/db.test.ts', 'node_modules/**'],
    env: {
      SESSION_PASSWORD: 'test-session-password-at-least-32-chars!!',
    },
  },
})
