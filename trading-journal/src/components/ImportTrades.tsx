import { useEffect, useMemo, useRef, useState } from 'react'
import { activeFields, isCalculated, type Field, type JournalData, type Trade } from '../lib/model'
import { applyImport, defaultImportOptions, parseCsv, previewImport, suggestMappings, type CsvData } from '../lib/csvImport'
import FieldEditor from './FieldEditor'
import './ImportTrades.css'

export default function ImportTrades({ data, update, notify, onDirty }: { data: JournalData; update: (change: (current: JournalData) => JournalData) => Promise<boolean>; notify: (message: string) => void; onDirty: (dirty: boolean) => void }) {
  const [csv, setCsv] = useState<CsvData | null>(null), [source, setSource] = useState(''), [filename, setFilename] = useState('')
  const [delimiter, setDelimiter] = useState(''), [mappings, setMappings] = useState<string[]>([]), [custom, setCustom] = useState<Field[]>([])
  const [options, setOptions] = useState(defaultImportOptions), [defaults, setDefaults] = useState<Record<string, string>>({}), [corrections, setCorrections] = useState<Record<number, Record<string, string>>>({})
  const [excluded, setExcluded] = useState<Set<number>>(new Set()), [ids, setIds] = useState<string[]>([]), [page, setPage] = useState(0)
  const [editor, setEditor] = useState<{ field: Field; column?: number }>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState('')
  const [batch, setBatch] = useState<{ fields: Field[]; trades: Trade[]; message: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const fields = useMemo(() => [...data.fields, ...custom.filter(f => !data.fields.some(saved => saved.id === f.id))], [data.fields, custom])
  const active = activeFields(fields).filter(f => !isCalculated(f))
  const preview = useMemo(() => {
    try { return { rows: csv ? previewImport(csv, mappings, fields, data.trades, options, ids, excluded, defaults, corrections) : [], error: '' } }
    catch (e) { return { rows: [], error: (e as Error).message } }
  }, [csv, mappings, fields, data.trades, options, ids, excluded, defaults, corrections])
  const selected = preview.rows.filter(r => r.included), invalid = selected.filter(r => r.errors.length).length
  const unfinished = selected.filter(r => r.missing.length && !r.errors.length).length
  const complete = selected.filter(r => !r.missing.length && !r.errors.length).length
  const shownFields = active.filter(f => mappings.includes(f.id) || f.required || defaults[f.id])
  useEffect(() => { onDirty(!!csv || !!batch); return () => onDirty(false) }, [csv, batch, onDirty])
  function read(text: string, separator: string) {
    try {
      const parsed = parseCsv(text, separator || undefined)
      setCsv(parsed); setMappings(suggestMappings(parsed.headers, data.fields)); setCustom([]); setDefaults({}); setCorrections({}); setExcluded(new Set()); setIds(parsed.rows.map(() => crypto.randomUUID())); setPage(0); setError(''); setResult('')
    } catch (e) { setCsv(null); setError((e as Error).message) }
  }
  async function save() {
    if (!batch && (!selected.length || invalid || preview.error)) return
    const timestamp = new Date().toISOString()
    const payload = batch || { fields: custom, trades: selected.map(r => ({ id: r.id, values: r.values, createdAt: timestamp, updatedAt: timestamp })), message: `Imported ${selected.length} trades: ${selected.length - unfinished} completed, ${unfinished} unfinished.` }
    setBatch(payload); setBusy(true)
    try {
      if (await update(current => applyImport(current, payload.fields, payload.trades))) {
        setResult(payload.message); notify(payload.message); setCsv(null); setSource(''); setFilename(''); setCustom([]); setBatch(null); onDirty(false)
        if (fileInput.current) fileInput.current.value = ''
      }
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="import-page">
    <div className="page-heading"><div><div className="eyebrow">BRING YOUR HISTORY</div><h1>Import trades<span className="heading-dot">.</span></h1><p>Match your CSV columns, review the trades, then save them to your journal.</p></div></div>
    {result && <div className="notice" role="status">{result}</div>}
    <fieldset disabled={busy || !!batch}>
      <section className="panel padded"><h2>1. Choose a CSV</h2><p>Files stay on this computer. Up to 10 MB, 10,000 trades, and 200 columns. The first row must contain column headers.</p>
        <div className="import-controls"><label>Trade CSV<input ref={fileInput} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return
          if (csv && !window.confirm('Replace this staged import?')) { e.target.value = ''; return }
          setBusy(true)
          try {
            if (file.size > 10 * 1024 * 1024) throw new Error('Choose a CSV smaller than 10 MB.')
            const bytes = new Uint8Array(await file.arrayBuffer())
            const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8'
            const text = new TextDecoder(encoding, { fatal: true }).decode(bytes)
            setSource(text); setFilename(file.name); read(text, delimiter)
          } catch (e) { setError((e as Error).message); setCsv(null); setSource(''); setFilename('') }
          finally { setBusy(false) }
        }} /></label><label>Separator<select value={delimiter} onChange={e => { if (csv && !window.confirm('Changing the separator resets the mappings and preview edits. Continue?')) return; setDelimiter(e.target.value); if (source) read(source, e.target.value) }}><option value="">Detect automatically</option><option value=",">Comma</option><option value=";">Semicolon</option><option value={'\t'}>Tab</option></select></label></div>
        {filename && <p>{filename} {csv && `— ${csv.rows.length} rows, ${csv.headers.length} columns`}</p>}
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {csv && <>
        <section className="panel padded"><h2>2. Match characteristics</h2><p>Suggestions are based on headers. Check every match. Skip unwanted columns or create a characteristic here; new characteristics are saved with the import.</p>
          <div className="import-scroll"><table><thead><tr><th>CSV column</th><th>Sample values</th><th>Journal characteristic</th><th /></tr></thead><tbody>{csv.headers.map((header, index) => <tr key={index}><th>{header}</th><td className="import-sample">{csv.rows.slice(0, 3).map(r => r.cells[index]).join(' / ')}</td><td><select aria-label={`Map column ${index + 1}: ${header}`} value={mappings[index]} onChange={e => { setMappings(current => current.map((value, i) => i === index ? e.target.value : value)); setCorrections({}) }}><option value="">Skip column</option>{active.map(f => <option key={f.id} value={f.id} disabled={mappings.includes(f.id) && mappings[index] !== f.id}>{f.name}{f.required ? ' *' : ''}</option>)}</select></td><td><button className="secondary compact" onClick={() => setEditor({ column: index, field: { id: crypto.randomUUID(), name: header, type: 'text', required: false, filter: true, analyze: true, options: [] } })}>Add characteristic</button></td></tr>)}</tbody></table></div>
          {custom.map(f => <div className="import-custom" key={f.id}><span>New: <strong>{f.name}</strong> · {f.type}{f.required && ' · required'}</span><button className="secondary compact" onClick={() => setEditor({ field: f })}>Edit {f.name}</button><button className="secondary compact" onClick={() => { setCustom(custom.filter(c => c.id !== f.id)); setMappings(mappings.map(id => id === f.id ? '' : id)) }}>Remove {f.name}</button></div>)}
          <div className="import-controls"><label>Source date format<select value={options.dateOrder} onChange={e => setOptions({ ...options, dateOrder: e.target.value as typeof options.dateOrder })}><option value="ymd">Year / month / day</option><option value="mdy">Month / day / year</option><option value="dmy">Day / month / year</option></select></label><label>Number format<select value={options.decimal} onChange={e => setOptions({ ...options, decimal: e.target.value as '.' | ',' })}><option value=".">1,234.56 (decimal point)</option><option value=",">1.234,56 (decimal comma)</option></select></label></div>
          <label className="check-label"><input type="checkbox" checked={options.fractionalPercent} onChange={e => setOptions({ ...options, fractionalPercent: e.target.checked })} />Percent values without a % sign are fractions (0.25 means 25%)</label>
          <p className="help-text">ISO dates are always accepted. Use separate date and time columns. BUY / SELL become LONG / SHORT. Text is capitalized; notes keep their original wording. PnL defaults to dollars. Map PnL unit or set its default below to POINTS for total point PnL. Automatic RR fields are calculated on save. No currency conversion is performed.</p>
          <details><summary>Defaults for unmapped characteristics</summary><p>Apply the same value to every row, such as an account or strategy. Leave blank to omit it.</p><div className="import-controls">{active.filter(f => !mappings.includes(f.id)).map(f => <label key={f.id}>{f.name}{f.required && ' *'}<input aria-label={`Default ${f.name}`} value={defaults[f.id] || ''} onChange={e => setDefaults({ ...defaults, [f.id]: e.target.value })} /></label>)}</div></details>
        </section>
        <section className="panel padded"><h2>3. Review trades</h2><p>Edit cells below to correct values. Preview edits use ISO dates, decimal points, and percent units (25 means 25%). Invalid values must be corrected or the row unchecked. Missing required values are allowed and go to the unfinished trade log.</p>
          <label className="check-label"><input type="checkbox" checked={options.skipDuplicates} onChange={e => setOptions({ ...options, skipDuplicates: e.target.checked })} />Skip exact duplicates of existing trades or earlier selected rows</label>
          {preview.error && <p role="alert" className="form-error">{preview.error}</p>}
          <div className="import-summary" role="status"><strong>{selected.length} selected</strong><span>{complete} complete</span><span>{unfinished} unfinished</span><span>{invalid} with invalid values</span><span>{csv.rows.length - selected.length} skipped</span></div>
          {!mappings.some(Boolean) ? <p>Map at least one column to preview trades.</p> : <div className="import-scroll"><table className="import-preview"><thead><tr><th>Include</th><th>CSV line / status</th>{shownFields.map(f => <th key={f.id}>{f.name}{f.required && ' *'}</th>)}</tr></thead><tbody>{preview.rows.slice(page * 25, (page + 1) * 25).map((row, offset) => { const index = page * 25 + offset; return <tr key={row.id}><td><input type="checkbox" aria-label={`Include line ${row.line}`} checked={row.included} disabled={row.empty || (row.duplicate && options.skipDuplicates)} onChange={e => setExcluded(current => { const next = new Set(current); if (e.target.checked) next.delete(index); else next.add(index); return next })} /></td><td className="import-row-status"><strong>Line {row.line}</strong><span>{row.empty ? 'Empty' : row.duplicate && options.skipDuplicates ? 'Duplicate skipped' : row.errors.length ? 'Invalid values' : row.missing.length ? 'Unfinished' : 'Complete'}</span>{row.errors.map((message, i) => <small className="negative" key={i}>{message}</small>)}{!!row.missing.length && <small>Missing: {row.missing.join(', ')}</small>}</td>{shownFields.map(f => <td key={f.id}><textarea rows={f.id === 'notes' ? 2 : 1} aria-label={`Line ${row.line} ${f.name}`} value={corrections[index]?.[f.id] ?? row.values[f.id] ?? ''} onChange={e => setCorrections(current => ({ ...current, [index]: { ...current[index], [f.id]: e.target.value } }))} /></td>)}</tr> })}</tbody></table></div>}
          <div className="import-pagination"><button className="secondary compact" disabled={!page} onClick={() => setPage(page - 1)}>Previous rows</button><span>Page {page + 1} of {Math.max(1, Math.ceil(preview.rows.length / 25))}</span><button className="secondary compact" disabled={(page + 1) * 25 >= preview.rows.length} onClick={() => setPage(page + 1)}>Next rows</button></div>
        </section>
      </>}
    </fieldset>
    {(csv || batch) && <div className="import-save"><p>{batch ? 'This batch is prepared. Retry to finish saving without adding duplicates.' : 'Completed trades appear in the master log and analytics. Existing trade records are preserved.'}</p><button className="primary" disabled={busy || (!batch && (!selected.length || !!invalid || !!preview.error))} onClick={() => { void save() }}>{busy ? 'Saving...' : batch ? 'Retry import' : `Import ${selected.length} trades`}</button></div>}
    {editor && <FieldEditor field={editor.field} fields={fields} trades={data.trades} onClose={() => setEditor(undefined)} onSave={async field => { setCustom(current => current.some(f => f.id === field.id) ? current.map(f => f.id === field.id ? field : f) : [...current, field]); if (editor.column !== undefined) setMappings(current => current.map((id, i) => i === editor.column ? field.id : id)); return true }} />}
  </div>
}
