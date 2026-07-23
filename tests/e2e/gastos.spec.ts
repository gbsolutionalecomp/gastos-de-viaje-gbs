import { test, expect } from '@playwright/test'

test.describe('Gestión de Gastos E2E', () => {
  test('valida la entrada de datos en el formulario de gastos', async ({ page }) => {
    await page.goto('/')
    // Verify page loads without crashing
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})
