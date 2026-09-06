import { test, expect, type Page } from '@playwright/test'
import { initialData, type JournalData } from '../../src/lib/model'

function oldJournal(): JournalData {
  const data = initialData()
  data.fields.find(f => f.id === 'contract')!.options.push('mnq', 'Mnq')
  data.fields.push({ id: 'mood', name: 'Mood', type: 'text', options: ['Calm', 'calm'], required: false, filter: true, analyze: true })
  const rows = [
    { date: '2026-09-01', contract: 'mnq', pnl: 140, strategy: 'orb' },
    { date: '2026-09-01', contract: 'MNQ', pnl: 289, strategy: 'ORB' },
    { date: '2026-09-01', contract: 'Mnq', pnl: 289, strategy: 'Orb' },
    { date: '2026-09-02', contract: 'es', pnl: -50, strategy: 'Reversal' },
    { date: '2026-09-02', contract: 'ES', pnl: 0, strategy: 'Trend' },
    { date: '2026-08-31', contract: 'ES', pnl: 500, strategy: 'ORB' },
    { date: '2026-09-01', contract: 'mnq', pnl: 9999, strategy: 'ORB', account: '' },
  ]
  data.trades = rows.map((row, index) => ({ id: `old-${index}`, createdAt: `${row.date}T10:00:00Z`, updatedAt: `${row.date}T10:00:00Z`, values: { direction: 'Long', account: 'blu1', timeIn: '09:30', timeOut: '10:00', size: 1, mood: index % 2 ? 'Calm' : 'calm', notes: '  Keep My Case\nAnd spacing.  ', ...row } }))
  data.journals['2026-09-01'] = { text: 'My daily Reflection stays Mixed Case.', updatedAt: '2026-09-01' }
  return data
}

async function restoreOldJournal(page: Page) {
  await page.goto('/')
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Import backup file', { exact: true }).setInputFiles({ name: 'old-journal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldJournal())) })
  await page.getByRole('button', { name: 'Back up current data & restore', exact: true }).click()
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  await page.getByRole('navigation').getByRole('button', { name: 'Dashboard', exact: true }).click()
}

test('older case variants combine in analytics, filters and dropdowns while notes retain their text', async ({ page }) => {
  await restoreOldJournal(page)
  const breakdown = page.locator('details.breakdown-detail').filter({ has: page.locator('summary').filter({ hasText: 'Contract' }) })
  await breakdown.locator('summary').click()
  const mnq = breakdown.locator('tbody tr').filter({ hasText: 'MNQ' })
  await expect(mnq).toHaveCount(1)
  await expect(mnq).toContainText('$718.00')
  await expect(mnq.locator('td').nth(1)).toHaveText('3')
  await page.getByLabel('Add filter', { exact: true }).selectOption('contract')
  await expect(page.getByLabel('Filter Contract', { exact: true }).locator('option')).toHaveText(['All values', 'Not recorded', 'ES', 'MNQ'])
  await page.getByLabel('Filter Contract', { exact: true }).selectOption('MNQ')
  await expect(page.locator('.stat-card').first()).toContainText('3 completed trades')
  await page.getByRole('navigation').getByRole('button', { name: 'Master trade log', exact: true }).click()
  await page.getByRole('button', { name: 'Edit trade MNQ 2026-09-01' }).first().click()
  await expect(page.locator('#field-contract')).toHaveValue('MNQ')
  await expect(page.locator('#field-contract-options option[value="MNQ"]')).toHaveCount(1)
  await expect(page.locator('#field-notes')).toHaveValue('  Keep My Case\nAnd spacing.  ')
  await page.locator('#field-contract').fill('mes')
  await page.locator('#field-mood').fill('happy')
  await expect(page.locator('#field-contract')).toHaveValue('MES')
  await expect(page.locator('#field-mood')).toHaveValue('HAPPY')
  await page.getByRole('button', { name: 'Save completed trade' }).click()
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: 'Daily journal', exact: true }).click()
  await page.getByLabel('Journal date', { exact: true }).fill('2026-09-01')
  await expect(page.getByLabel('Journal entry', { exact: true })).toHaveValue('My daily Reflection stays Mixed Case.')
})

test('calendar shows daily stats, applies filters, browses months and fits both racing themes', async ({ page }) => {
  await restoreOldJournal(page)
  await page.getByLabel('Calendar month', { exact: true }).fill('2026-09')
  const calendar = page.locator('.performance-calendar')
  const first = calendar.locator('[data-date="2026-09-01"]')
  await expect(first).toContainText('$718.00')
  await expect(first).toContainText('3 trades')
  await expect(first).toContainText('100%')
  await expect(first).toContainText('ORB')
  await expect(calendar.locator('[data-date="2026-09-02"]')).toContainText('-$50.00')
  await expect(calendar.locator('[data-date="2026-09-02"]')).toContainText('0%')
  await expect(calendar.getByLabel('Calendar month summary')).toContainText('$668.00')
  await calendar.locator('[data-date="2026-09-02"]').click()
  await expect(page.getByRole('dialog')).toContainText('REVERSAL')
  await expect(page.getByRole('dialog')).toContainText('TREND')
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Previous month', exact: true }).click()
  await expect(page.getByLabel('Calendar month', { exact: true })).toHaveValue('2026-08')
  await expect(calendar.locator('[data-date="2026-08-31"]')).toContainText('$500.00')
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  if (await page.getByRole('button', { name: 'Dismiss notification' }).isVisible()) await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await calendar.screenshot({ path: 'test-results/calendar-racing-dark.png' })
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await calendar.screenshot({ path: 'test-results/calendar-racing-light.png' })
  await page.getByLabel('Add filter', { exact: true }).selectOption('contract')
  await page.getByLabel('Filter Contract', { exact: true }).selectOption('MNQ')
  await expect(calendar.getByLabel('Calendar month summary')).toContainText('$718.00')
  await expect(calendar.locator('[data-date="2026-09-02"]')).toBeDisabled()
  await page.getByLabel('From date', { exact: true }).fill('2026-08-01')
  await page.getByLabel('To date', { exact: true }).fill('2026-08-31')
  await expect(page.getByLabel('Calendar month', { exact: true })).toHaveValue('2026-08')
  await expect(calendar).toContainText('No completed trades in this month match your current filters.')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await calendar.locator('.calendar-scroll').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
})
