import { app, BrowserWindow, ipcMain, screen, shell, type IpcMainInvokeEvent, type Rectangle } from 'electron'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { JournalStore } from './store'
const directory = path.dirname(fileURLToPath(import.meta.url))
const devUrl = process.env.VITE_DEV_SERVER_URL
let win: BrowserWindow | null = null
let store: JournalStore | undefined
let minimalist = false
let fullBounds: Rectangle | undefined
let fullMaximized = false
// This directory is part of our upgrade contract. Never derive it from a version,
// install folder, or productName: packaged apps must find the development journal.
const dataDirectory = process.env.TURBO_TEST_DATA_DIR || path.join(app.getPath('appData'), 'trading-journal')
mkdirSync(dataDirectory, { recursive: true })
app.setPath('userData', dataDirectory)
const trusted = (event: IpcMainInvokeEvent) => {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted request')
}
function createWindow() {
  minimalist = false
  fullBounds = undefined
  win = new BrowserWindow({ width: 1440, height: 960, minWidth: 780, minHeight: 600, title: 'Turbo Trading Journal', icon: path.join(directory, devUrl ? '../public/turbo.ico' : '../dist/turbo.ico'), backgroundColor: '#0b1113', autoHideMenuBar: true, show: !process.env.TURBO_TEST_DATA_DIR,
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

function setMinimalist(enabled: boolean) {
  if (!win || minimalist === enabled) return
  minimalist = enabled
  if (enabled) {
    fullBounds = win.getNormalBounds()
    fullMaximized = win.isMaximized()
    const { workArea } = screen.getDisplayMatching(win.getBounds())
    if (win.isMaximized()) win.unmaximize()
    // Includes the native Windows title bar; the form itself is about 135px tall.
    win.setMinimumSize(640, 180)
    win.setBounds({ x: workArea.x, y: workArea.y + workArea.height - 190, width: workArea.width, height: 190 })
  } else {
    if (win.isMaximized()) win.unmaximize()
    win.setMinimumSize(780, 600)
    if (fullBounds) {
      const { workArea } = screen.getDisplayMatching(fullBounds)
      const width = Math.min(Math.max(fullBounds.width, 780), workArea.width)
      const height = Math.min(Math.max(fullBounds.height, 600), workArea.height)
      win.setBounds({ width, height, x: Math.max(workArea.x, Math.min(fullBounds.x, workArea.x + workArea.width - width)), y: Math.max(workArea.y, Math.min(fullBounds.y, workArea.y + workArea.height - height)) })
    }
    if (fullMaximized) win.maximize()
  }
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (win?.isMinimized()) win.restore(); win?.focus() })
  app.whenReady().then(() => {
    app.setAppUserModelId('com.turbo.tradingjournal')
    ipcMain.handle('app:info', event => {
      trusted(event)
      return { version: app.getVersion(), dataDirectory, packaged: app.isPackaged }
    })
    ipcMain.handle('app:open-data', async event => {
      trusted(event)
      const error = await shell.openPath(dataDirectory)
      if (error) throw new Error(error)
    })
    ipcMain.handle('window:always-on-top', (event, enabled: unknown) => {
      trusted(event)
      if (typeof enabled !== 'boolean') throw new Error('Invalid pin mode')
      win?.setAlwaysOnTop(enabled)
    })
    ipcMain.handle('window:minimalist', (event, enabled: unknown) => {
      trusted(event)
      if (typeof enabled !== 'boolean') throw new Error('Invalid window mode')
      setMinimalist(enabled)
    })
    ipcMain.handle('journal:load', event => {
      trusted(event)
      store ??= new JournalStore(path.join(dataDirectory, 'trading_journal.db'), app.getVersion())
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
