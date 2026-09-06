import { contextBridge, ipcRenderer } from 'electron'
import type { JournalData } from '../src/lib/model'
contextBridge.exposeInMainWorld('journalAPI', {
  load: (): Promise<JournalData> => ipcRenderer.invoke('journal:load'),
  save: (data: JournalData): Promise<void> => ipcRenderer.invoke('journal:save', data),
  setMinimalist: (enabled: boolean): Promise<void> => ipcRenderer.invoke('window:minimalist', enabled),
  appInfo: (): Promise<{ version: string; dataDirectory: string; packaged: boolean }> => ipcRenderer.invoke('app:info'),
  openDataFolder: (): Promise<void> => ipcRenderer.invoke('app:open-data'),
})
