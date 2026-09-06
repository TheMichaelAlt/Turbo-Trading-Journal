import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JournalStore } from '../electron/store.ts'
test('SQLite atomically persists trades, fields and long journal pages across restarts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'turbo-store-test-')), filename = join(directory, 'journal.db')
  try {
    let store = new JournalStore(filename)
    const data = store.load()
    data.journals['2026-09-01'] = { text: 'A reflection. '.repeat(5000), updatedAt: '2026-09-01T12:00:00Z' }
    data.trades.push({ id: 'zero', values: { pnl: 0 }, createdAt: '2026-09-01', updatedAt: '2026-09-01' })
    data.theme = 'light'
    store.save(data); store.close()
    store = new JournalStore(filename)
    assert.deepEqual(store.load(), data)
    assert.throws(() => store.save({ ...data, fields: [] }))
    assert.deepEqual(store.load(), data)
    store.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
test('first launch migrates the starter tables once and leaves legacy data intact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'turbo-migrate-test-')), filename = join(directory, 'journal.db')
  try {
    const legacy = new DatabaseSync(filename)
    legacy.exec('CREATE TABLE trades (id INTEGER PRIMARY KEY, date TEXT, pnl REAL, custom_tags TEXT); CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);')
    legacy.prepare('INSERT INTO trades VALUES (1, ?, ?, ?)').run('2026-09-01', 0, '{"Mood":"Calm"}')
    legacy.prepare('INSERT INTO settings VALUES (?, ?)').run('custom_attributes', '["Mood"]'); legacy.close()
    let store = new JournalStore(filename), data = store.load()
    assert.equal(data.trades[0].values.pnl, 0); assert.equal(data.trades[0].values['legacy-field-0'], 'CALM')
    data = { ...data, trades: [] }; store.save(data); store.close()
    store = new JournalStore(filename); assert.equal(store.load().trades.length, 0); store.close()
    const original = new DatabaseSync(filename); assert.equal((original.prepare('SELECT count(*) AS n FROM trades').get() as { n: number }).n, 1); original.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('new versions snapshot committed WAL data once and retain the full journal', () => {
  const directory = mkdtempSync(join(tmpdir(), 'turbo-version-test-')), filename = join(directory, 'journal.db')
  let previous: JournalStore | undefined, next: JournalStore | undefined
  try {
    previous = new JournalStore(filename, '1.0.0')
    const data = previous.load()
    data.fields.push({ id: 'mood', name: 'Mood', type: 'text', options: ['CALM'], required: true, filter: true, analyze: true })
    data.trades.push({ id: 'retained', values: { date: '2026-09-01', pnl: 0, mood: 'CALM', notes: 'Keep My notes.' }, createdAt: '2026-09-01', updatedAt: '2026-09-01' })
    data.journals['2026-09-01'] = { text: 'Keep every reflection.\n'.repeat(500), updatedAt: '2026-09-01' }
    data.minimalist = true
    previous.save(data)
    assert.equal(existsSync(join(directory, 'backups')), false)
    // Leave the earlier connection open so the upgrade has to preserve WAL data.
    next = new JournalStore(filename, '1.0.1')
    assert.deepEqual(next.load(), data)
    const names = readdirSync(join(directory, 'backups'))
    assert.equal(names.length, 1)
    const snapshot = new DatabaseSync(join(directory, 'backups', names[0]), { readOnly: true })
    try {
      assert.deepEqual(JSON.parse(String(snapshot.prepare('SELECT data FROM journal_state WHERE id = 1').get()!.data)), data)
      assert.equal(snapshot.prepare("SELECT value FROM app_metadata WHERE key = 'last_app_version'").get()!.value, '1.0.0')
    } finally { snapshot.close() }
    previous.close(); previous = undefined
    next.close(); next = new JournalStore(filename, '1.0.1')
    assert.deepEqual(next.load(), data)
    assert.equal(readdirSync(join(directory, 'backups')).length, 1)
  } finally { next?.close(); previous?.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('a failed upgrade backup leaves stored trades and the last successful version untouched', () => {
  const directory = mkdtempSync(join(tmpdir(), 'turbo-backup-error-')), filename = join(directory, 'journal.db')
  try {
    const store = new JournalStore(filename, '1.0.0')
    const data = store.load()
    data.trades.push({ id: 'keep', values: { pnl: 25 }, createdAt: '2026-09-01', updatedAt: '2026-09-01' })
    store.save(data); store.close()
    writeFileSync(join(directory, 'backups'), 'A file blocks creating the backup folder.')
    assert.throws(() => new JournalStore(filename, '1.0.1'))
    const reopened = new JournalStore(filename, '1.0.0')
    assert.deepEqual(reopened.load(), data)
    reopened.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
