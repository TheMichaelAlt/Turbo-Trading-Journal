import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { migrateLegacy, parseBackup, type JournalData } from '../src/lib/model.ts'
export class JournalStore {
  private db: DatabaseSync
  private releaseVersion?: string
  constructor(filename: string, releaseVersion?: string) {
    this.db = new DatabaseSync(filename)
    this.releaseVersion = releaseVersion
    try {
      this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;')
      if (releaseVersion) this.backupBeforeUpgrade(filename, releaseVersion)
      this.db.exec('CREATE TABLE IF NOT EXISTS journal_state (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)')
    } catch (error) { this.db.close(); throw error }
  }
  private backupBeforeUpgrade(filename: string, version: string) {
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]
    const previous = tables.some(t => t.name === 'app_metadata')
      ? this.db.prepare("SELECT value FROM app_metadata WHERE key = 'last_app_version'").get() as { value: string } | undefined : undefined
    if (!tables.length || previous?.value === version) return
    const folder = join(dirname(filename), 'backups')
    mkdirSync(folder, { recursive: true })
    const safeVersion = version.replace(/[^a-zA-Z0-9.-]/g, '_')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    // VACUUM INTO creates a consistent SQLite snapshot, including committed WAL
    // records. Copying just the .db file could omit the most recent trades.
    this.db.prepare('VACUUM INTO ?').run(join(folder, `before-${safeVersion}-${stamp}-${randomUUID()}.db`))
  }
  private releaseLoaded(data: JournalData): JournalData {
    if (this.releaseVersion) {
      this.db.exec('CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
      this.db.prepare("INSERT INTO app_metadata (key, value) VALUES ('last_app_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(this.releaseVersion)
    }
    return data
  }
  load(): JournalData {
    const row = this.db.prepare('SELECT data FROM journal_state WHERE id = 1').get() as { data: string } | undefined
    if (row) return this.releaseLoaded(parseBackup(JSON.parse(row.data)))
    const hasTable = (name: string) => !!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
    const rows = hasTable('trades') ? this.db.prepare('SELECT * FROM trades ORDER BY id').all() as Record<string, unknown>[] : []
    const setting = hasTable('settings') ? this.db.prepare("SELECT value FROM settings WHERE key = 'custom_attributes'").get() as { value: string } | undefined : undefined
    const data = migrateLegacy(rows, setting ? JSON.parse(setting.value) : [])
    this.save(data)
    return this.releaseLoaded(data)
  }
  save(data: unknown): void {
    const valid = parseBackup(data)
    this.db.prepare('INSERT INTO journal_state (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').run(JSON.stringify(valid))
  }
  close() { this.db.close() }
}
