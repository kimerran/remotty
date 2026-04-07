import { test, expect } from '@playwright/test'

test('redirects unauthenticated user to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('login page renders brand', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Remotty v1.0')).toBeVisible()
  await expect(page.getByText('Agent Orchestrator')).toBeVisible()
})

test('login with wrong credentials shows error', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="username"]', 'admin')
  await page.fill('input[name="password"]', 'wrong-password')
  await page.click('button[type="submit"]')
  await expect(page.getByText(/invalid credentials/i)).toBeVisible()
})

test('login with correct credentials reaches /sessions/new', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="username"]', process.env['ADMIN_USERNAME'] ?? 'admin')
  await page.fill('input[name="password"]', process.env['ADMIN_PASSWORD'] ?? 'admin-change-me')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/sessions\/new/)
  await expect(page.getByText(/new session/i)).toBeVisible()
})
