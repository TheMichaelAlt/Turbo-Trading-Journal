import { contextBridge, ipcRenderer } from 'electron'
import type { JournalData } from '../src/lib/model'
contextBridge.exposeInMainWorld('journalAPI', {
  load: (): Promise<JournalData> => ipcRenderer.invoke('journal:load'),
  save: (data: JournalData): Promise<void> => ipcRenderer.invoke('journal:save', data),
})
