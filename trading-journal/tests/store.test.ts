import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
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
