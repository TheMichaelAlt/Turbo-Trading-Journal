const { _electron: electron, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { mkdtempSync, mkdirSync, existsSync, readdirSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const { build, Platform, Arch } = require('electron-builder')
const { DatabaseSync } = require('node:sqlite')
const { version } = require('../package.json')

function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, windowsVerbatimArguments: true, stdio: 'ignore' })
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Installer timed out: ${file}`)) }, 120000)
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Installer exited ${code}: ${file}`)) })
  })
}
async function main() {
  if (process.platform !== 'win32') throw new Error('The installer upgrade check requires Windows')
  const project = path.resolve(__dirname, '..')
  const directory = mkdtempSync(path.join(tmpdir(), 'turbo-installer-test-'))
  const installDirectory = path.join(directory, 'installed')
  const dataDirectory = path.join(directory, 'journal')
  mkdirSync(dataDirectory)
  const testName = `Turbo Journal Upgrade Test ${path.basename(directory)}`
  const parts = version.split('.').map(Number)
  const nextVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  const artifacts = path.join(project, '.test-data', path.basename(directory))
  const env = { ...process.env, TURBO_TEST_DATA_DIR: dataDirectory }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.VITE_DEV_SERVER_URL
  const executablePath = path.join(installDirectory, `${testName}.exe`)
  let app, installed = false
  try {
    for (const fixtureVersion of [version, nextVersion]) {
      await build({ projectDir: project, targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), publish: 'never', config: {
        extends: path.join(project, 'electron-builder.json5'),
        appId: `com.turbo.tradingjournal.upgradetest.${path.basename(directory)}`,
        productName: testName,
        executableName: testName,
        extraMetadata: { version: fixtureVersion },
        directories: { output: path.join(artifacts, fixtureVersion) },
        nsis: { createDesktopShortcut: false, createStartMenuShortcut: false, runAfterFinish: false },
      } })
    }
    const installer = v => path.join(artifacts, v, `${testName}-Windows-${v}-Setup.exe`)
    await run(installer(version), ['/S', '/currentuser', `/D=${installDirectory}`])
    installed = true
    assert.ok(existsSync(executablePath), 'First installer creates the application')
    app = await electron.launch({ executablePath, env, timeout: 30000 })
    let page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: 'Performance overview.' })).toBeVisible()
    assert.equal((await page.evaluate(() => window.journalAPI.appInfo())).version, version)
    await page.getByRole('button', { name: 'Explore sample data' }).click()
    await expect(page.locator('.save-status')).toHaveText('Saved locally')
    // Exercise both complete and unfinished records, custom values, long writing,
    // and appearance preferences through the same validated persistence bridge.
    const expected = await page.evaluate(async () => {
      const data = await window.journalAPI.load()
      data.trades.push({ id: 'unfinished-upgrade', values: { date: '2026-09-01', contract: 'MNQ', pnl: 0, notes: 'Keep My notes.' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' })
      data.journals['2026-09-01'] = { text: 'A long retained journal.\n'.repeat(500), updatedAt: '2026-09-01' }
      data.theme = 'light'; data.minimalist = true
      await window.journalAPI.save(data)
      return data
    })
    await app.close(); app = undefined
    await run(installer(nextVersion), ['/S', '/currentuser', `/D=${installDirectory}`])
    app = await electron.launch({ executablePath, env, timeout: 30000 }); page = await app.firstWindow()
    await expect(page.getByRole('form', { name: 'Minimalist trade entry' })).toBeVisible()
    assert.equal((await page.evaluate(() => window.journalAPI.appInfo())).version, nextVersion)
    assert.deepEqual(await page.evaluate(() => window.journalAPI.load()), expected)
    const backupFiles = readdirSync(path.join(dataDirectory, 'backups'))
    assert.equal(backupFiles.length, 1)
    const snapshot = new DatabaseSync(path.join(dataDirectory, 'backups', backupFiles[0]), { readOnly: true })
    try { assert.deepEqual(JSON.parse(String(snapshot.prepare('SELECT data FROM journal_state WHERE id = 1').get().data)), expected) } finally { snapshot.close() }
    const report = { from: version, to: nextVersion, retainedTrades: expected.trades.length, retainedFields: expected.fields.length, backups: backupFiles.length }
    console.log('PASS: real NSIS install/upgrade retained the entire journal and created a pre-upgrade database snapshot.', JSON.stringify(report))
  } finally {
    await app?.close()
    const uninstaller = path.join(installDirectory, `Uninstall ${testName}.exe`)
    // Uninstall only the isolated fixture, after checking its resolved directory.
    const relative = path.relative(directory, path.resolve(uninstaller))
    if (installed && !relative.startsWith('..') && !path.isAbsolute(relative) && existsSync(uninstaller)) {
      await run(uninstaller, ['/S', '/currentuser', `_?=${installDirectory}`])
      assert.ok(existsSync(path.join(dataDirectory, 'trading_journal.db')), 'Test uninstall preserves journal data')
    }
    console.log('Isolated installer artifacts:', artifacts)
    console.log('Isolated install/profile:', directory)
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
