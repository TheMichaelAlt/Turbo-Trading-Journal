import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { APP_VERSION } from '../lib/version'

export default function ReleaseInfo() {
  const [info, setInfo] = useState<{ version: string; dataDirectory: string }>()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void window.journalAPI?.appInfo().then(value => { if (active) setInfo(value) }).catch(() => { if (active) setError('App details could not be loaded.') })
    return () => { active = false }
  }, [])
  return <section className="panel padded" style={{ marginTop: 24 }} aria-label="Version and updates">
    <h2>Turbo Trading Journal <span className="tag">v{info?.version || APP_VERSION}</span></h2>
    <p className="muted">To update, save your work, close the app, and run the newer Windows installer. Your master log, unfinished trades, characteristics, and journal pages stay on this PC. Updates are installed manually.</p>
    {info && <><p className="help-text">A database backup is created in the backups folder when a different version first opens your existing journal. Use Export backup above for a portable copy you can restore from Settings.</p><p className="help-text" style={{ overflowWrap: 'anywhere', marginTop: 12 }}>Data folder: {info.dataDirectory}</p><button className="secondary compact" style={{ marginTop: 12 }} onClick={() => { void window.journalAPI?.openDataFolder().catch(() => setError('The data folder could not be opened.')) }}><FolderOpen size={14} />Open data folder</button></>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
