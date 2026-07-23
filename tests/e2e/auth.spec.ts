import { test, expect } from '@playwright/test'

test.describe('Autenticación y Navegación E2E', () => {
  test('debe mostrar la página principal', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/gastos/i)
  })

  test('redirecciona a login si la ruta protegida requiere auth', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*login/)
  })
})
