import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
  },
  webServer: process.env['CI'] ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
