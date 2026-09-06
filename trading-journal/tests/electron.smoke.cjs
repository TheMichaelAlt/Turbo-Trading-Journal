const { _electron: electron, expect } = require('@playwright/test')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const directory = mkdtempSync(path.join(tmpdir(), 'turbo-electron-test-'))
const environment = { ...process.env, TURBO_TEST_DATA_DIR: directory }
delete environment.ELECTRON_RUN_AS_NODE
const launch = () => electron.launch({ args: ['.'], env: environment, timeout: 30000 })
async function main() {
  let app
  try {
    app = await launch()
    let page = await app.firstWindow()
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await expect(page.getByRole('heading', { name: 'Performance overview.' })).toBeVisible()
    assert.equal(await page.evaluate(() => typeof window.journalAPI?.load), 'function')
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
    await page.getByRole('button', { name: 'Explore sample data' }).click()
    await expect(page.locator('.save-status')).toHaveText('Saved locally')
    await expect(page.locator('.stat-card').first()).toContainText('64 completed trades')
    await page.getByRole('navigation').getByRole('button', { name: 'Daily journal', exact: true }).click()
    await page.getByLabel('Journal date', { exact: true }).fill('2026-09-01')
    await page.getByLabel('Journal entry', { exact: true }).fill('Desktop SQLite restart check.\nA retained reflection.')
    await expect(page.locator('.save-status')).toHaveText('Saved locally')
    await app.close(); app = await launch(); page = await app.firstWindow()
    await expect(page.locator('.stat-card').first()).toContainText('64 completed trades')
    await page.getByRole('navigation').getByRole('button', { name: 'Daily journal', exact: true }).click()
    await page.getByLabel('Journal date', { exact: true }).fill('2026-09-01')
    await expect(page.getByLabel('Journal entry', { exact: true })).toHaveValue('Desktop SQLite restart check.\nA retained reflection.')
    assert.deepEqual(errors, [])
    console.log('PASS: Electron bridge, SQLite saves, 64 trades and daily journal survive a full app restart.')
    console.log('Isolated test profile:', directory)
  } finally { await app?.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
