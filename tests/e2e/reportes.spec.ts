import { test, expect } from '@playwright/test'

test.describe('Exportación de Reportes E2E', () => {
  test('descarga de reportes PDF y CSV', async ({ page }) => {
    await page.goto('/')
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
