import { useEffect, useRef, type ReactNode } from 'react'
import { X, ArrowUpRight, Minus, Activity } from 'lucide-react'
import { type Field, type Trade, isNumeric, characteristicValue } from '../lib/model'
import { type Filters, emptyFilters, metrics } from '../lib/analytics'
import { money, number } from '../lib/format'
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal(); const dialog = ref.current; return () => dialog?.close() }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={e => { e.preventDefault(); onClose() }} aria-labelledby="dialog-title">
    <div className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}
  </dialog>
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Activity size={30} /></div><h3>{title}</h3><p>{children}</p>{action}</div>
}
export function StatCards({ trades, currency }: { trades: Trade[]; currency: string }) {
  const s = metrics(trades)
  return <div className="stat-grid">
    <article className="stat-card teal"><div className="stat-label">Net PnL<ArrowUpRight size={17} /></div><strong className={s.net < 0 ? 'negative' : ''}>{money(s.net, currency)}</strong><span>{s.count} completed trades{s.excluded > 0 ? ` · ${s.excluded} without PnL excluded` : ''}</span></article>
    <article className="stat-card pink"><div className="stat-label">Win rate<span className="tiny-mark">%</span></div><strong>{number(s.winRate, 1)}<small>%</small></strong><span>{s.wins} wins · {s.losses} losses · {s.breakeven} flat</span></article>
    <article className="stat-card purple"><div className="stat-label">Profit factor<Activity size={17} /></div><strong>{number(s.profitFactor)}</strong><span>Gross profit / gross loss</span></article>
    <article className="stat-card orange"><div className="stat-label">Expectancy<Minus size={17} /></div><strong className={s.expectancy < 0 ? 'negative' : ''}>{money(s.expectancy, currency)}</strong><span>Average PnL per trade</span></article>
  </div>
}
export function FilterBar({ fields, trades, value, onChange }: { fields: Field[]; trades: Trade[]; value: Filters; onChange: (filters: Filters) => void }) {
  const available = fields.filter(f => !f.archived && f.filter && f.id !== 'date')
  return <div className="filter-panel">
    <div className="filter-top"><span className="eyebrow">FILTER YOUR TRADES</span><button className="text-button" onClick={() => onChange(emptyFilters())}>Reset filters</button></div>
    <div className="filter-row">
      <label>From<input aria-label="From date" type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })} /></label>
      <label>To<input aria-label="To date" type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })} /></label>
      {value.rules.map((rule, index) => {
        const field = fields.find(f => f.id === rule.field)
        if (!field) return null
        const update = (patch: Partial<typeof rule>) => onChange({ ...value, rules: value.rules.map((r, i) => i === index ? { ...r, ...patch } : r) })
        const options = [...new Set([...trades.map(t => t.values[field.id]), ...(rule.value ? [rule.value] : [])].filter(v => v !== undefined && v !== '').map(v => String(characteristicValue(field, v))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        return <div className="filter-rule" key={field.id}><label>{field.name}{isNumeric(field) ? <div className="range-inputs"><input type="number" step="any" placeholder="Min" aria-label={`${field.name} minimum`} disabled={rule.missing} value={rule.min || ''} onChange={e => update({ min: e.target.value })} /><span>–</span><input type="number" step="any" placeholder="Max" aria-label={`${field.name} maximum`} disabled={rule.missing} value={rule.max || ''} onChange={e => update({ max: e.target.value })} /></div> : <select aria-label={`Filter ${field.name}`} value={rule.missing ? '__missing__' : rule.value || ''} onChange={e => update({ missing: e.target.value === '__missing__', value: e.target.value === '__missing__' ? '' : e.target.value })}><option value="">All values</option><option value="__missing__">Not recorded</option>{options.map(v => <option value={v} key={v}>{v}</option>)}</select>}</label>
          {isNumeric(field) && <label className="check-label filter-missing"><input type="checkbox" checked={!!rule.missing} onChange={e => update({ missing: e.target.checked })} />Missing</label>}
          <button className="icon-button remove-filter" aria-label={`Remove ${field.name} filter`} onClick={() => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) })}><X size={14} /></button></div>
      })}
      <label className="add-filter-label">Characteristic<select aria-label="Add filter" value="" onChange={e => { if (e.target.value) onChange({ ...value, rules: [...value.rules, { field: e.target.value }] }) }}><option value="">+ Add filter</option>{available.filter(f => !value.rules.some(r => r.field === f.id)).map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label>
    </div>
    {value.from && value.to && value.from > value.to && <p className="form-error">The start date must be before the end date.</p>}
    {value.rules.some(r => r.min && r.max && Number(r.min) > Number(r.max)) && <p className="form-error">A minimum exceeds its maximum. Adjust that filter to see results.</p>}
  </div>
}
