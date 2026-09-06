import assert from 'node:assert/strict'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { DatabaseSync } from 'node:sqlite'

const directory = mkdtempSync(join(tmpdir(), 'turbo-startup-test-'))
process.env.TURBO_TEST_DATA_DIR = directory
process.env.ELECTRON_RUN_AS_NODE = '1'
process.env.VITE_DEV_SERVER_URL = 'http://127.0.0.1:1'
const { desktop } = await import('../scripts/start.mjs')

try {
  const filename = join(directory, 'trading_journal.db')
  let loaded = false
  const deadline = Date.now() + 15000
  while (!loaded && Date.now() < deadline) {
    await setTimeout(150)
    if (!existsSync(filename)) continue
    const db = new DatabaseSync(filename, { readOnly: true })
    try {
      const table = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'journal_state'").get()
      if (table) loaded = !!db.prepare('SELECT data FROM journal_state WHERE id = 1').get()
    } finally { db.close() }
  }
  assert.ok(loaded, 'Standalone desktop must load despite inherited Node mode and an unavailable Vite URL')
  console.log('PASS: standalone launcher loads the app without a running development server.')
  console.log('Isolated test profile:', directory)
} finally {
  // Only this test-created desktop process is terminated. The real journal remains open.
  desktop.kill()
}
