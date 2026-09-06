const { _electron: electron, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const { mkdtempSync, existsSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { version } = require('../package.json')
const asar = require('@electron/asar')

async function main() {
  const directory = mkdtempSync(path.join(tmpdir(), 'turbo-release-test-'))
  const folder = path.resolve(__dirname, '../release', version, 'win-unpacked')
  const executablePath = path.join(folder, 'Turbo Trading Journal.exe')
  assert.ok(existsSync(executablePath), 'Build the Windows release first')
  const files = asar.listPackage(path.join(folder, 'resources/app.asar'))
  assert.ok(!files.some(name => /\.(db|sqlite|sqlite3)(-|$)|[\\/](?:tests|\.test-data|\.git|test-results)[\\/]/i.test(name)), 'Package must exclude personal databases, backups, source control and tests')
  const env = { ...process.env, TURBO_TEST_DATA_DIR: directory }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.VITE_DEV_SERVER_URL
  let app
  try {
    app = await electron.launch({ executablePath, env, timeout: 30000 })
    let page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: 'Performance overview.' })).toBeVisible()
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true)
    const info = await page.evaluate(() => window.journalAPI.appInfo())
    assert.equal(info.version, version)
    assert.equal(info.dataDirectory, directory)
    const initial = await page.evaluate(() => window.journalAPI.load())
    assert.equal(initial.trades.length, 0, 'New install starts empty')
    assert.deepEqual(initial.journals, {})
    await page.getByRole('button', { name: 'Explore sample data' }).click()
    await expect(page.locator('.save-status')).toHaveText('Saved locally')
    await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Version and updates' })).toContainText(`v${version}`)
    await expect(page.getByRole('region', { name: 'Version and updates' })).toContainText('Updates are installed manually.')
    await app.close(); app = await electron.launch({ executablePath, env, timeout: 30000 }); page = await app.firstWindow()
    await expect(page.locator('.stat-card').first()).toContainText('64 completed trades')
    console.log(`PASS: packaged Windows ${version} starts offline, contains no journal data, displays its version, and retains SQLite trades across restarts.`)
    console.log('Isolated profile:', directory)
  } finally { await app?.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
