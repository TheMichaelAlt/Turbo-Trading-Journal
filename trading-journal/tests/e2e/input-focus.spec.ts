import { test, expect } from '@playwright/test'
test('canceling navigation retains typing and discarding allows typing in a fresh entry', async ({ page }) => {
  await page.goto('/')
  const nav = (name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  await nav('Trade log')
  await page.locator('#field-contract').pressSequentially('mnq')
  for (let i = 0; i < 3; i++) {
    await nav('Dashboard')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await page.locator('#field-notes').click()
    await page.locator('#field-notes').pressSequentially('still typing ')
  }
  await expect(page.locator('#field-notes')).toHaveValue('still typing still typing still typing ')
  await expect(page.locator('#field-contract')).toHaveValue('MNQ')
  await nav('Dashboard'); await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await nav('Trade log'); await page.locator('#field-contract').pressSequentially('mes')
  await expect(page.locator('#field-contract')).toHaveValue('MES')
})
