import { DatabaseSync } from 'node:sqlite'
import { migrateLegacy, parseBackup, type JournalData } from '../src/lib/model.ts'
export class JournalStore {
  private db: DatabaseSync
  constructor(filename: string) {
    this.db = new DatabaseSync(filename)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;')
    this.db.exec('CREATE TABLE IF NOT EXISTS journal_state (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)')
  }
  load(): JournalData {
    const row = this.db.prepare('SELECT data FROM journal_state WHERE id = 1').get() as { data: string } | undefined
    if (row) return parseBackup(JSON.parse(row.data))
    const hasTable = (name: string) => !!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
    const rows = hasTable('trades') ? this.db.prepare('SELECT * FROM trades ORDER BY id').all() as Record<string, unknown>[] : []
    const setting = hasTable('settings') ? this.db.prepare("SELECT value FROM settings WHERE key = 'custom_attributes'").get() as { value: string } | undefined : undefined
    const data = migrateLegacy(rows, setting ? JSON.parse(setting.value) : [])
    this.save(data)
    return data
  }
  save(data: unknown): void {
    const valid = parseBackup(data)
    this.db.prepare('INSERT INTO journal_state (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').run(JSON.stringify(valid))
  }
  close() { this.db.close() }
}
