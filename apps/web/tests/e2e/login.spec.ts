import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/username/i).fill('nonexistent')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/invalid credentials/i)).toBeVisible()
  })

  test('login page redirects to sessions dashboard on success', async ({ page }) => {
    // This test requires seeded admin credentials from ADMIN_USERNAME/ADMIN_PASSWORD env vars
    // In CI, these might not be set, so we skip if not configured
    const username = process.env['ADMIN_USERNAME']
    const password = process.env['ADMIN_PASSWORD']
    if (!username || !password) {
      test.skip(true, 'Admin credentials not configured')
    }

    await page.goto('/login')
    await page.getByLabel(/username/i).fill(String(username))
    await page.getByLabel(/password/i).fill(String(password))
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/sessions')
    await expect(page).toHaveURL(/sessions/)
  })
})

test.describe('Sessions Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    const username = process.env['ADMIN_USERNAME']
    const password = process.env['ADMIN_PASSWORD']
    if (!username || !password) {
      test.skip(true, 'Admin credentials not configured')
    }
    await page.goto('/login')
    await page.getByLabel(/username/i).fill(String(username))
    await page.getByLabel(/password/i).fill(String(password))
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/sessions')
  })

  test('sessions page loads', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible()
  })

  test('new session page loads', async ({ page }) => {
    await page.goto('/sessions/new')
    await expect(page.getByRole('heading', { name: /new session/i })).toBeVisible()
  })
})
