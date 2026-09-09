import { initialData, parseBackup, type JournalData } from './model.ts'
declare global {
  interface Window { journalAPI?: { restoreTyping?: () => Promise<{ logged: boolean }>;  load: () => Promise<JournalData>; save: (data: JournalData) => Promise<void>; setAlwaysOnTop?: (enabled: boolean) => Promise<void>; setMinimalist: (enabled: boolean) => Promise<void>; appInfo: () => Promise<{ version: string; dataDirectory: string; packaged: boolean }>; openDataFolder: () => Promise<void> } }
}
let database: Promise<IDBDatabase> | undefined
function browserDb() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('turbo-trading-journal', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('journal')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return database
}
export const storageMode = () => window.journalAPI ? 'Desktop · SQLite' : 'This browser · local storage'
export async function loadData(): Promise<JournalData> {
  if (window.journalAPI) return parseBackup(await window.journalAPI.load())
  const db = await browserDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction('journal', 'readonly').objectStore('journal').get('data')
    request.onsuccess = () => { try { resolve(request.result ? parseBackup(request.result) : initialData()) } catch (e) { reject(e) } }
    request.onerror = () => reject(request.error)
  })
}
export async function saveData(data: JournalData): Promise<void> {
  if (window.journalAPI) return window.journalAPI.save(data)
  const db = await browserDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('journal', 'readwrite')
    transaction.objectStore('journal').put(data, 'data')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('Save was interrupted'))
  })
}
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function csvCell(value: unknown) {
  let text = String(value ?? '')
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
