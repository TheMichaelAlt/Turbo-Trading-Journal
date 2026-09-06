import { test, expect, type Page } from '@playwright/test'
const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name: new RegExp('^' + name) }).click()
const csv = 'Date,Entry Time,Exit Time,Side,Symbol,Qty,Profit,Account,Strategy,Notes,Mood\n2026-09-06,9:30 AM,10:00 AM,buy,mnq,1,100,sim,orb,"Keep My, Notes",calm\n2026-09-06,09:30,,sell,es,1,oops,sim,orb,Second note,tired'
async function upload(page: Page, contents = csv) {
  await page.getByLabel('Trade CSV', { exact: true }).setInputFiles({ name: 'trades.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) })
}
async function stored(page: Page) {
  return page.evaluate(async () => { const path = '/src/lib/storage.ts'; const { loadData } = await import(/* @vite-ignore */ path); return loadData() })
}
test('map CSV, create custom characteristic, correct preview, save complete and unfinished trades, deduplicate and reload', async ({ page }) => {
  await page.goto('/'); await nav(page, 'Import trades'); await upload(page)
  await expect(page.getByLabel('Map column 5: Symbol')).toHaveValue('contract')
  await page.getByRole('row').filter({ has: page.getByLabel('Map column 11: Mood', { exact: true }) }).getByRole('button', { name: 'Add characteristic' }).click()
  await page.getByLabel('Required to complete a trade').check()
  await page.getByRole('button', { name: 'Save characteristic', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Import 2 trades', exact: true })).toBeDisabled()
  await page.getByLabel('Line 3 PnL', { exact: true }).fill('-25.5')
  await expect(page.getByRole('button', { name: 'Import 2 trades', exact: true })).toBeEnabled()
  await page.screenshot({ path: 'test-results/import-preview.png', fullPage: true })
  await page.getByRole('button', { name: 'Import 2 trades', exact: true }).click()
  await expect(page.locator('.import-page')).toContainText('Imported 2 trades: 1 completed, 1 unfinished.')
  let data = await stored(page)
  expect(data.trades).toHaveLength(2)
  expect(data.trades[0].values).toMatchObject({ contract: 'MNQ', direction: 'LONG', notes: 'Keep My, Notes', pnl: 100 })
  const mood = data.fields.find((f: { name: string }) => f.name === 'Mood')!
  expect(mood.required).toBe(true); expect(mood.options).toEqual(['CALM', 'TIRED'])
  await page.reload(); await nav(page, 'Master trade log')
  await expect(page.locator('main')).toContainText('MNQ')
  await nav(page, 'Import trades'); await upload(page, csv.replace('oops', '-25.5'))
  await expect(page.getByRole('button', { name: 'Import 0 trades', exact: true })).toBeDisabled()
  await expect(page.locator('.import-preview')).toContainText('Duplicate skipped')
  page.on('dialog', dialog => dialog.accept())
  await upload(page, 'a,b\n1')
  await expect(page.getByRole('alert')).toContainText('columns')
  data = await stored(page); expect(data.trades).toHaveLength(2)
})
test('failed persistence retries a stable batch without duplicate records', async ({ page }) => {
  await page.goto('/'); await nav(page, 'Import trades')
  await page.evaluate(() => {
    let attempts = 0
    Object.assign(window, { journalAPI: { save: async () => { if (++attempts === 1) throw new Error('Test disk unavailable') } } })
  })
  await upload(page, 'Mood\nCalm')
  await page.getByRole('button', { name: 'Add characteristic', exact: true }).click()
  await page.getByRole('button', { name: 'Save characteristic', exact: true }).click()
  await page.getByRole('button', { name: 'Import 1 trades', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Retry import', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Retry import', exact: true }).click()
  await expect(page.locator('.import-page')).toContainText('Imported 1 trades')
  await nav(page, 'Trade log')
  await expect(page.locator('.draft-card')).toHaveCount(1)
})
