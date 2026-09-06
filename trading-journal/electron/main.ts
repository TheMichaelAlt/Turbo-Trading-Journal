import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { JournalStore } from './store'
const directory = path.dirname(fileURLToPath(import.meta.url))
const devUrl = process.env.VITE_DEV_SERVER_URL
let win: BrowserWindow | null = null
let store: JournalStore | undefined
// Test runs use a separate profile; normal app data keeps the starter's location.
if (process.env.TURBO_TEST_DATA_DIR) app.setPath('userData', process.env.TURBO_TEST_DATA_DIR)
const trusted = (event: IpcMainInvokeEvent) => {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted request')
}
function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 960, minWidth: 780, minHeight: 600, title: 'Turbo Trading Journal', backgroundColor: '#0b1113', autoHideMenuBar: true, show: !process.env.TURBO_TEST_DATA_DIR,
    webPreferences: { preload: path.join(directory, 'preload.mjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    const current = win?.webContents.getURL()
    if (url !== current) event.preventDefault()
  })
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(path.join(directory, '../dist/index.html'))
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (win?.isMinimized()) win.restore(); win?.focus() })
  app.whenReady().then(() => {
    ipcMain.handle('journal:load', event => {
      trusted(event)
      store ??= new JournalStore(path.join(app.getPath('userData'), 'trading_journal.db'))
      return store.load()
    })
    ipcMain.handle('journal:save', (event, data: unknown) => {
      trusted(event)
      if (!store) throw new Error('Load the journal before saving.')
      store.save(data)
    })
    createWindow()
  })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() })
  app.on('will-quit', () => store?.close())
}
