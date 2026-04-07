import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    env: {
      SESSION_PASSWORD: 'test-session-password-at-least-32-chars!!',
    },
  },
})
