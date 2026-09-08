import { useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, CalendarDays, Trash2 } from 'lucide-react'
import { today, validDate, isComplete, type JournalData } from '../lib/model'
import { pnlTrades } from '../lib/pnl'
import { metrics } from '../lib/analytics'
import { Modal } from './ui'
import { money } from '../lib/format'
import { tradingDay } from '../lib/tradingDay'
export default function DailyJournal({ data, onChange, status }: { data: JournalData; onChange: (date: string, text: string) => void; status: string }) {
  const [date, setDate] = useState(today), [remove, setRemove] = useState(false)
  const entry = data.journals[date], text = entry?.text || ''
  const dates = Object.keys(data.journals).filter(d => data.journals[d].text.trim()).sort().reverse()
  const dayTrades = data.trades.filter(t => tradingDay(t, data.tradingDayEnd) === date && isComplete(t, data.fields)), stats = metrics(pnlTrades(dayTrades, 'dollars', data))
  const move = (amount: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + amount); setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) }
  return <>
    <div className="page-heading"><div><div className="eyebrow">MAKE SPACE TO REFLECT</div><h1>Daily journal<span className="heading-dot">.</span></h1><p>The thoughts behind the numbers. A page for every day.</p></div><span className="tag"><BookOpen size={14} />{dates.length} entries</span></div>
    <div className="journal-layout"><aside className="panel journal-sidebar"><div className="panel-heading"><h2>Your pages</h2><CalendarDays size={18} /></div><div className="journal-date-nav"><button className="icon-button" aria-label="Previous day" onClick={() => move(-1)}><ChevronLeft size={18} /></button><input aria-label="Journal date" type="date" value={date} onChange={e => { if (validDate(e.target.value)) setDate(e.target.value) }} /><button className="icon-button" aria-label="Next day" onClick={() => move(1)}><ChevronRight size={18} /></button></div><button className="text-button today-button" onClick={() => setDate(today())}>Back to today</button><div className="journal-entry-list">{dates.length ? dates.map(d => <button key={d} className={d === date ? 'selected' : ''} onClick={() => setDate(d)}><strong>{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong><span>{data.journals[d].text.slice(0, 65)}</span></button>) : <p className="muted padded">Your written pages will appear here.</p>}</div></aside>
    <section className="panel journal-page"><div className="journal-paper-heading"><div className="eyebrow">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}</div><h2>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</h2><div className="journal-day-stats"><span>{dayTrades.length} completed trades</span><span className={stats.net < 0 ? 'negative' : 'positive'}>{money(stats.net, data.currency)} net PnL{stats.excluded > 0 && ` (${stats.excluded} missing PnL / multiplier)`}</span><span>{stats.count ? `${stats.winRate.toFixed(0)}% win rate` : 'A fresh perspective'}</span></div></div>
      <label className="sr-only" htmlFor="journal-text">Journal entry</label><textarea id="journal-text" className="journal-text" placeholder={'What’s on your mind?\n\nReflect on your session, capture a lesson, or simply write. This space is yours.'} value={text} onChange={e => onChange(date, e.target.value)} />
      <div className="journal-footer"><span>{text.trim() ? text.trim().split(/\s+/).length.toLocaleString() : 0} words · {status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved — retry above' : 'All changes saved locally'}</span><button className="text-button danger" disabled={!text} onClick={() => setRemove(true)}><Trash2 size={14} />Clear page</button></div>
    </section></div>
    {remove && <Modal title="Clear this journal page?" onClose={() => setRemove(false)}><p>This removes the writing for {date}. Your trades are unaffected.</p><div className="modal-actions"><button className="secondary" onClick={() => setRemove(false)}>Keep page</button><button className="danger-button" onClick={() => { onChange(date, ''); setRemove(false) }}>Clear page</button></div></Modal>}
  </>
}
