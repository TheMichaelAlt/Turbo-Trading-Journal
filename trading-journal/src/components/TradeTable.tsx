import { useState } from 'react'
import { Columns3, Download, Pencil, Search, Trash2 } from 'lucide-react'
import { historicalFields, isComplete, isBlank, type JournalData, type Trade } from '../lib/model'
import { chronological, emptyFilters, filterTrades } from '../lib/analytics'
import { csvCell, downloadFile } from '../lib/storage'
import { Empty, FilterBar, Modal } from './ui'
import { pnlUnit } from '../lib/pnl'
import { money, number } from '../lib/format'
import TradeNotes from './TradeNotes'
export default function TradeTable({ data, onEdit, onDelete, onNew, update }: { update: (change: (current: JournalData) => JournalData) => Promise<boolean>; data: JournalData; onEdit: (t: Trade) => void; onDelete: (id: string) => Promise<boolean>; onNew: () => void }) {
  const filters = data.lastFilters?.master?.filters || emptyFilters(), search = data.lastFilters?.master?.search || ''
  const setFilters = (filters: ReturnType<typeof emptyFilters>) => { void update(current => ({ ...current, lastFilters: { ...current.lastFilters, master: { ...current.lastFilters?.master, filters } } })) }
  const setSearch = (search: string) => { void update(current => ({ ...current, lastFilters: { ...current.lastFilters, master: { filters: current.lastFilters?.master?.filters || emptyFilters(), search } } })) }

  const [columns, setColumns] = useState<string[] | null>(null)
  const [columnOpen, setColumnOpen] = useState(false), [deleting, setDeleting] = useState<Trade | null>(null), [busy, setBusy] = useState(false)
  const [sort, setSort] = useState<{ id: string; desc: boolean }>({ id: 'date', desc: true }), [page, setPage] = useState(0)
  const completed = data.trades.filter(t => isComplete(t, data.fields)), fields = historicalFields(data)
  const filtered = filterTrades(completed, filters).filter(t => fields.some(f => String(t.values[f.id] ?? '').toLowerCase().includes(search.toLowerCase())))
  const trades = chronological(filtered).sort((a, b) => {
    const av = a.values[sort.id] ?? '', bv = b.values[sort.id] ?? ''
    const delta = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true })
    return sort.desc ? -delta : delta
  })
  const selectedColumns = columns ?? fields.filter(f => !f.archived).map(f => f.id)
  const visible = fields.filter(f => selectedColumns.includes(f.id)), pages = Math.max(1, Math.ceil(trades.length / 25)), currentPage = Math.min(page, pages - 1)
  const exportCsv = () => {
    const rows = [fields.map(f => f.name), ...trades.map(t => fields.map(f => t.values[f.id] ?? ''))]
    downloadFile('turbo-trades.csv', '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">YOUR COMPLETE RECORD</div><h1>Master trade log<span className="heading-dot">.</span></h1><p>Every completed trade, with all the details that matter to you.</p></div><button className="secondary" onClick={exportCsv} disabled={!trades.length}><Download size={16} />Export CSV</button></div>
    <FilterBar fields={data.fields} trades={completed} value={filters} onChange={value => { setFilters(value); setPage(0) }} />
    <section className="panel"><div className="panel-heading"><div className="search-input"><Search size={17} /><input aria-label="Search trades" placeholder="Search all trade details…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} /></div><div className="button-row"><span className="muted">{trades.length} trades</span><button className="secondary compact" onClick={() => setColumnOpen(true)}><Columns3 size={15} />Columns</button></div></div>
      {!trades.length ? <Empty title={completed.length ? 'No matching trades.' : 'A clean slate.'} action={<button className="primary" onClick={onNew}>Log a trade</button>}>{completed.length ? 'Adjust your search or filters to see more trades.' : 'Completed entries move here automatically. Unfinished entries stay on the trade log page.'}</Empty> : <><div className="table-scroll"><table className="master-table"><thead><tr>{visible.map(f => <th key={f.id}><button className="sort-button" onClick={() => setSort({ id: f.id, desc: sort.id === f.id ? !sort.desc : false })}>{f.name} {sort.id === f.id ? sort.desc ? '↓' : '↑' : ''}</button></th>)}<th>Actions</th></tr></thead><tbody>{trades.slice(currentPage * 25, currentPage * 25 + 25).map(t => <tr key={t.id}>{visible.map(f => <td className={f.id === 'pnl' ? Number(t.values.pnl) < 0 ? 'negative numeric' : 'positive numeric' : ''} key={f.id}>{f.id === 'pnlUnit' && isBlank(t.values[f.id]) ? 'DOLLARS' : isBlank(t.values[f.id]) ? <span className="muted">—</span> : f.id === 'notes' ? <TradeNotes text={String(t.values[f.id])} /> : f.id === 'pnl' ? money(Number(t.values.pnl), pnlUnit(t.values) === 'points' ? 'PTS' : data.currency) : ['tradeRR', 'realizedRR'].includes(f.id) ? `${number(Number(t.values[f.id]))} R` : f.id === 'direction' ? <span className={`tag ${t.values.direction === 'LONG' ? 'teal' : 'pink'}`}>{t.values.direction}</span> : <span className={f.id === 'notes' ? 'table-notes' : ''} title={String(t.values[f.id])}>{t.values[f.id]}{f.type === 'percent' ? '%' : ''}</span>}{f.id === 'date' && t.demo && <span className="demo-label">DEMO</span>}</td>)}<td><div className="button-row"><button className="icon-button" aria-label={`Edit trade ${t.values.contract} ${t.values.date}`} onClick={() => onEdit(t)}><Pencil size={15} /></button><button className="icon-button danger" aria-label={`Delete trade ${t.values.contract} ${t.values.date}`} onClick={() => setDeleting(t)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing {currentPage * 25 + 1}–{Math.min((currentPage + 1) * 25, trades.length)} of {trades.length}</span><div className="button-row"><button className="secondary compact" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage + 1} / {pages}</span><button className="secondary compact" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></div></>}
    </section>
    {columnOpen && <Modal title="Visible columns" onClose={() => setColumnOpen(false)}><p>Defaults follow the active characteristics in Settings. Select a removed characteristic to view its historical values. Your CSV export still includes all characteristics.</p><div className="column-picker">{fields.map(f => <label className="check-label" key={f.id}><input type="checkbox" checked={selectedColumns.includes(f.id)} onChange={e => setColumns(e.target.checked ? [...selectedColumns, f.id] : selectedColumns.filter(id => id !== f.id))} />{f.name}{f.archived && <span className="tag">Removed</span>}</label>)}</div><div className="modal-actions"><button className="secondary" onClick={() => setColumns(null)}>Use active characteristics</button><button className="primary" onClick={() => setColumnOpen(false)}>Done</button></div></Modal>}
    {deleting && <Modal title="Delete this trade?" onClose={() => setDeleting(null)}><p>{deleting.values.date} · {deleting.values.contract} · {isBlank(deleting.values.pnl) ? 'No PnL' : money(Number(deleting.values.pnl), pnlUnit(deleting.values) === 'points' ? 'PTS' : data.currency)}</p><p>This permanently removes the trade from the master log and analytics.</p><div className="modal-actions"><button className="secondary" onClick={() => setDeleting(null)}>Keep trade</button><button className="danger-button" disabled={busy} onClick={async () => { setBusy(true); if (await onDelete(deleting.id)) setDeleting(null); setBusy(false) }}>Delete trade</button></div></Modal>}
  </>
}
