import { test, expect } from '@playwright/test'
import { initialData } from '../../src/lib/model'
test('cutoff persists, regroups old trades and keeps master newest entry first', async ({ page }) => {
  const data = initialData()
  data.trades = [['2026-09-08','18:00',100], ['2026-09-09','09:00',-40], ['2026-09-09','16:00',500]].map(([date, timeIn, pnl], i) => ({ id: String(i), createdAt: '', updatedAt: '', values: { date, timeIn, timeOut: '19:00', pnl, direction: 'LONG', contract: 'ES', size: 1, account: 'SIM', strategy: 'ORB' } }))
  const nav = async (name: string) => { await page.getByRole('navigation').getByRole('button', { name, exact: true }).click() }
  await page.goto('/'); await nav('Settings')
  await page.getByLabel('Import backup file', { exact: true }).setInputFiles({ name: 'days.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await page.getByRole('button', { name: 'Back up current data & restore', exact: true }).click()
  await expect(page.getByLabel('End of trading day', { exact: true })).toHaveValue('15:00')
  await nav('Dashboard'); await page.getByLabel('Calendar month', { exact: true }).fill('2026-09')
  await expect(page.locator('[data-date="2026-09-09"]')).toContainText('$60.00')
  await expect(page.locator('[data-date="2026-09-09"]')).toContainText('2 trades')
  await nav('Master trade log')
  const rows = page.locator('.master-table tbody tr')
  await expect(rows.nth(0)).toContainText('16:00'); await expect(rows.nth(1)).toContainText('09:00'); await expect(rows.nth(2)).toContainText('2026-09-08')
  await nav('Settings'); await page.getByLabel('End of trading day', { exact: true }).fill('17:00')
  await expect(page.locator('.save-status')).toHaveText('Saved locally'); await page.reload(); await nav('Settings')
  await expect(page.getByLabel('End of trading day', { exact: true })).toHaveValue('17:00')
  await nav('Dashboard'); await page.getByLabel('Calendar month', { exact: true }).fill('2026-09')
  await expect(page.locator('[data-date="2026-09-09"]')).toContainText('$560.00')
  await nav('Daily journal'); await page.getByLabel('Journal date', { exact: true }).fill('2026-09-09')
  await expect(page.locator('.journal-day-stats')).toContainText('3 completed trades')
})
