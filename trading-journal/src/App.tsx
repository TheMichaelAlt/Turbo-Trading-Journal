import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowUpRight, BookOpen, CheckCircle2, Database, LayoutDashboard, Moon, Plus, Settings, Sun } from 'lucide-react'
import Dashboard from './components/Dashboard'
import TurboIcon from './components/TurboIcon'
import TradeEntry from './components/TradeEntry'
import TradeTable from './components/TradeTable'
import DailyJournal from './components/DailyJournal'
import Preferences from './components/Preferences'
import { isComplete, learnOptions, normalizeValues, normalizeCharacteristics, type JournalData, type Trade, type Values } from './lib/model'
import { loadData, saveData, storageMode } from './lib/storage'
import { addDemo } from './lib/demo'
type Page = 'dashboard' | 'entry' | 'master' | 'journal' | 'settings'
const pages: { id: Page; name: string; icon: typeof Activity }[] = [{ id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard }, { id: 'entry', name: 'Trade log', icon: Plus }, { id: 'master', name: 'Master trade log', icon: Database }, { id: 'journal', name: 'Daily journal', icon: BookOpen }, { id: 'settings', name: 'Settings', icon: Settings }]
export default function App() {
  const [data, setData] = useState<JournalData | null>(null), dataRef = useRef<JournalData | null>(null)
  const [page, setPage] = useState<Page>('dashboard'), [editing, setEditing] = useState<Trade | undefined>(), [formKey, setFormKey] = useState(0)
  const [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState(''), [status, setStatus] = useState('saved'), [toast, setToast] = useState('')
  const dirty = useRef(false), pending = useRef(0), queue = useRef(Promise.resolve()), saveFailed = useRef(false)
  const notify = useCallback((message: string) => setToast(message), [])
  useEffect(() => { let active = true; loadData().then(value => { if (active) { dataRef.current = value; setData(value) } }).catch(e => { if (active) setLoadError(e instanceof Error ? e.message : 'Could not load your data.') }); return () => { active = false } }, [])
  useEffect(() => { if (data) document.documentElement.dataset.theme = data.theme }, [data])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer) }, [toast])
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty.current || pending.current || saveFailed.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard)
  }, [])
  const update = useCallback((change: (current: JournalData) => JournalData): Promise<boolean> => {
    if (!dataRef.current) return Promise.resolve(false)
    const next = normalizeCharacteristics(change(dataRef.current))
    dataRef.current = next; setData(next); pending.current++; setStatus('saving')
    const task = queue.current.then(async () => {
      try { await saveData(next); saveFailed.current = false; setSaveError(''); return true }
      catch (e) { saveFailed.current = true; setSaveError(e instanceof Error ? e.message : 'Could not save changes.'); return false }
      finally { pending.current--; if (!pending.current) setStatus(saveFailed.current ? 'error' : 'saved') }
    })
    queue.current = task.then(() => undefined)
    return task
  }, [])
  const onDirty = useCallback((value: boolean) => { dirty.current = value }, [])
  const canLeave = () => !dirty.current || window.confirm('Discard the unsaved changes to this trade?')
  const navigate = (next: Page) => { if (next === page) return; if (!canLeave()) return; dirty.current = false; setPage(next); setEditing(undefined) }
  const newTrade = () => { if (!canLeave()) return; dirty.current = false; setEditing(undefined); setFormKey(k => k + 1); setPage('entry') }
  const editTrade = (trade: Trade) => { if (!canLeave()) return; dirty.current = false; setEditing(trade); setFormKey(k => k + 1); setPage('entry') }
  const saveTrade = async (raw: Values, id?: string) => {
    const current = dataRef.current!
    const values = normalizeValues(raw, current.fields), timestamp = new Date().toISOString()
    const existing = current.trades.find(t => t.id === id)
    const trade: Trade = { id: id || crypto.randomUUID(), createdAt: existing?.createdAt || timestamp, updatedAt: timestamp, values, ...(existing?.demo ? { demo: true } : {}) }
    const result = await update(state => ({ ...state, fields: learnOptions(state.fields, values), trades: state.trades.some(t => t.id === trade.id) ? state.trades.map(t => t.id === trade.id ? trade : t) : [...state.trades, trade] }))
    if (result) { dirty.current = false; setEditing(undefined); setFormKey(k => k + 1); notify(isComplete(trade, dataRef.current!.fields) ? 'Trade completed. Added to the master log and analytics.' : 'Unfinished trade saved. Finish it whenever you’re ready.') }
    return result
  }
  const deleteTrade = async (id: string) => { const result = await update(current => ({ ...current, trades: current.trades.filter(t => t.id !== id) })); if (result) { if (editing?.id === id) { dirty.current = false; setEditing(undefined); setFormKey(k => k + 1) } notify('Trade deleted. Analytics updated.') } return result }
  const demo = async () => { if (await update(addDemo)) notify('64 sample trades added. Remove them anytime in Settings.') }
  if (loadError) return <div className="boot-screen"><TurboIcon size={40} /><h1>Your data couldn’t be opened.</h1><p>{loadError}</p><p>Existing storage has been left untouched.</p><button className="primary" onClick={() => location.reload()}>Try again</button></div>
  if (!data) return <div className="boot-screen"><TurboIcon size={40} /><h1>Starting Turbo Journal…</h1></div>
  const drafts = data.trades.filter(t => !isComplete(t, data.fields)).length
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => navigate('dashboard')} aria-label="Turbo Journal home"><span className="brand-mark"><TurboIcon size={29} /></span><span><strong>TURBO<span>↗</span></strong><small>TRADING JOURNAL</small></span></button><div className="sidebar-caption">YOUR TRADING WORKSPACE</div><nav aria-label="Main navigation">{pages.map(({ id, name, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} /><span>{name}</span>{id === 'entry' && drafts > 0 && <b>{drafts}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="eyebrow">LESS GUESSWORK.</span><strong>More perspective.</strong><p>Your process is your edge.<br />Make every trade count.</p><ArrowUpRight size={27} /></div><button className="theme-toggle" onClick={() => { void update(current => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' })) }}>{data.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{data.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span><span className="theme-switch"><i /></span></button><div className="local-label"><span className="status-dot" />{storageMode()}</div></div></aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{pages.find(p => p.id === page)?.name}</strong></div><div className="topbar-right"><span className={`save-status ${status === 'error' ? 'negative' : ''}`} role="status"><CheckCircle2 size={14} />{status === 'saving' ? 'Saving…' : status === 'error' ? 'Unsaved changes' : 'Saved locally'}</span><span className="version-pill">YOUR EDGE, DECODED</span></div></header>
    <main>{saveError && <div className="save-error" role="alert"><strong>Changes are in memory but haven’t been saved.</strong><span>{saveError}</span><button className="secondary compact" onClick={() => { void update(current => ({ ...current })) }}>Retry save</button></div>}
      {page === 'dashboard' && <Dashboard data={data} onNew={newTrade} onDemo={() => { void demo() }} />}
      {page === 'entry' && <TradeEntry key={formKey} data={data} editing={editing} onEdit={editTrade} onSave={saveTrade} onDelete={deleteTrade} onCancel={newTrade} onDirty={onDirty} />}
      {page === 'master' && <TradeTable data={data} onEdit={editTrade} onDelete={deleteTrade} onNew={newTrade} />}
      {page === 'journal' && <DailyJournal data={data} status={status} onChange={(date, text) => { void update(current => ({ ...current, journals: { ...current.journals, [date]: { text, updatedAt: new Date().toISOString() } } })) }} />}
      {page === 'settings' && <Preferences data={data} update={update} onDemo={() => { void demo() }} notify={notify} />}
      <footer className="app-footer"><span>TURBO JOURNAL</span><span>Reflect. Refine. Repeat.</span><span>LOCAL FIRST · V1.0</span></footer>
    </main></div>{toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
  </div>
}
