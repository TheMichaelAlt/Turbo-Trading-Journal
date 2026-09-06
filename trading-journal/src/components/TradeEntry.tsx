import { useEffect, useRef, useState } from 'react'
import { Check, CheckCircle2, Clock3, Pencil, Save, Trash2 } from 'lucide-react'
import { activeFields, fieldError, isBlank, isComplete, isNumeric, today, tradeIssues, type Field, type JournalData, type Trade, type Values } from '../lib/model'
import { Empty, Modal } from './ui'
import { money } from '../lib/format'
export function FieldInput({ field, value, onChange, error }: { field: Field; value: string | number | undefined; onChange: (value: string) => void; error?: string }) {
  const id = `field-${field.id}`
  const common = { id, value: value ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(e.target.value), 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined }
  return <div className={`form-field ${field.id === 'notes' ? 'full-width' : ''}`}><label htmlFor={id}>{field.name}{field.required && <span className="required" title="Required">*</span>}</label>
    {field.id === 'direction' ? <select {...common}><option value="">Select direction</option><option>Long</option><option>Short</option></select> : field.id === 'notes' ? <textarea {...common} rows={4} placeholder="What did you notice? What would you do differently?" /> : field.type === 'score' && (field.max ?? 5) - (field.min ?? 1) <= 20 ? <select {...common}><option value="">Select score</option>{Array.from({ length: (field.max ?? 5) - (field.min ?? 1) + 1 }, (_, i) => (field.min ?? 1) + i).map(v => <option value={v} key={v}>{v}</option>)}</select> : <><input {...common} type={isNumeric(field) ? 'number' : field.type === 'date' || field.type === 'time' ? field.type : 'text'} step={field.type === 'score' || field.type === 'integer' ? '1' : field.type === 'time' ? '1' : 'any'} min={field.min} max={field.max} list={field.type === 'text' && field.options.length ? `${id}-options` : undefined} placeholder={field.type === 'text' ? 'Choose or type a value' : isNumeric(field) ? field.min !== undefined && field.max !== undefined ? `${field.min} to ${field.max}` : '0' : undefined} autoComplete="off" />{field.type === 'text' && <datalist id={`${id}-options`}>{field.options.map(o => <option value={o} key={o} />)}</datalist>}</>}
    {error && <span id={`${id}-error`} className="field-error">{error}</span>}
  </div>
}
export default function TradeEntry({ data, editing, onEdit, onSave, onDelete, onCancel, onDirty }: { data: JournalData; editing?: Trade; onEdit: (trade: Trade) => void; onSave: (values: Values, id?: string) => Promise<boolean>; onDelete: (id: string) => Promise<boolean>; onCancel: () => void; onDirty: (dirty: boolean) => void }) {
  const fresh = () => ({ date: today() })
  const [values, setValues] = useState<Values>(editing?.values || fresh)
  const submissionId = useRef(editing?.id || crypto.randomUUID())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false), [deleting, setDeleting] = useState<Trade | null>(null)
  const fields = activeFields(data.fields), required = fields.filter(f => f.required), optional = fields.filter(f => !f.required)
  const filled = required.filter(f => !fieldError(f, values[f.id])).length
  const issues = tradeIssues(values, fields)
  const drafts = data.trades.filter(t => !isComplete(t, data.fields)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  useEffect(() => () => onDirty(false), [onDirty])
  const change = (id: string, value: string) => { setValues(prev => ({ ...prev, [id]: value })); setErrors(prev => ({ ...prev, [id]: '' })); onDirty(true) }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const invalid = issues.filter(i => !isBlank(values[i.field.id]))
    if (invalid.length) { setErrors(Object.fromEntries(invalid.map(i => [i.field.id, i.error]))); document.getElementById(`field-${invalid[0].field.id}`)?.focus(); return }
    setBusy(true)
    const saved = await onSave(values, submissionId.current)
    setBusy(false)
    if (saved) { setValues(fresh()); setErrors({}); onDirty(false) }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">CAPTURE THE DETAILS</div><h1>Trade log<span className="heading-dot">.</span></h1><p>Record the trade. Reflect on the process.</p></div><span className="tag yellow"><Clock3 size={14} />{drafts.length} unfinished</span></div>
    <div className="entry-layout"><form className="panel entry-form" noValidate onSubmit={save}>
      <div className="panel-heading"><div><h2>{editing ? 'Edit trade' : 'New trade'}</h2><p>Required fields are marked with <span className="required">*</span>. You can save an unfinished entry anytime.</p></div>{editing && <button type="button" className="text-button" onClick={onCancel}>Cancel edit</button>}</div>
      <div className="completion-strip"><span className={issues.length === 0 ? 'positive' : ''}>{issues.length === 0 ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}{filled} / {required.length} required fields</span><div className="progress-track"><i style={{ width: `${required.length ? filled / required.length * 100 : 100}%` }} /></div><span>{issues.length === 0 ? 'Ready for master log' : 'Unfinished entry'}</span></div>
      <div className="form-section"><h3>Trade essentials</h3><div className="form-grid">{required.map(f => <FieldInput key={f.id} field={f} value={values[f.id]} onChange={v => change(f.id, v)} error={errors[f.id]} />)}</div></div>
      {!!optional.length && <div className="form-section"><div className="section-line"><h3>The context behind the trade</h3><span className="tag">Optional</span></div><div className="form-grid">{optional.map(f => <FieldInput key={f.id} field={f} value={values[f.id]} onChange={v => change(f.id, v)} error={errors[f.id]} />)}</div></div>}
      <div className="form-footer"><p>{issues.length === 0 ? 'This trade will appear in the master log and analytics.' : `${required.length - filled} required field(s) left. This entry will stay here until complete.`}</p><button className="primary" type="submit" disabled={busy}><Save size={16} />{busy ? 'Saving…' : issues.length === 0 ? 'Save completed trade' : 'Save unfinished trade'}</button></div>
    </form>
    <aside className="draft-column"><div className="panel"><div className="panel-heading"><div><h2>Finish where you left off</h2><p>Your unfinished entries</p></div></div>{!drafts.length ? <Empty title="All caught up.">Unfinished entries will wait here until you’re ready to complete them.</Empty> : <div className="draft-list">{drafts.map(t => { const missing = tradeIssues(t.values, data.fields); return <article className={`draft-card ${editing?.id === t.id ? 'selected' : ''}`} key={t.id}><div className="section-line"><strong>{t.values.contract || 'New trade'} <span className="muted">{t.values.direction}</span></strong><span className="tag yellow">Unfinished</span></div><p>{t.values.date || 'No date'} · {t.values.account || 'No account'}</p><div className="draft-pnl">{!isBlank(t.values.pnl) ? money(Number(t.values.pnl), data.currency) : 'PnL not recorded'}</div><p className="missing-copy">Needs: {missing.map(i => i.field.name).join(', ')}</p><div className="button-row"><button className="secondary compact" onClick={() => onEdit(t)}><Pencil size={14} />Finish entry</button><button className="icon-button danger" aria-label={`Delete unfinished trade ${t.values.contract || ''} ${t.values.date || ''}`} onClick={() => setDeleting(t)}><Trash2 size={15} /></button></div></article> })}</div>}</div><div className="entry-tip"><Check size={17} /><p>New text values are remembered as dropdown options. Make any characteristic required in Settings.</p></div></aside></div>
    {deleting && <Modal title="Delete unfinished trade?" onClose={() => setDeleting(null)}><p>This removes the {deleting.values.contract || 'unfinished'} entry for {deleting.values.date || 'an unspecified date'}. This cannot be undone.</p><div className="modal-actions"><button className="secondary" onClick={() => setDeleting(null)}>Keep trade</button><button className="danger-button" disabled={busy} onClick={async () => { setBusy(true); if (await onDelete(deleting.id)) setDeleting(null); setBusy(false) }}>Delete trade</button></div></Modal>}
  </>
}
