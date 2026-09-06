import { useState } from 'react'
import { ArrowUpRight, Download, Layers3, SlidersHorizontal } from 'lucide-react'
import { activeFields, isComplete, type JournalData, type Trade, type Field } from '../lib/model'
import { dailyResults, emptyFilters, filterTrades, groupTrades, metrics } from '../lib/analytics'
import { csvCell, downloadFile } from '../lib/storage'
import { Empty, FilterBar, StatCards } from './ui'
import { money, number } from '../lib/format'
import { DailyChart, EquityChart } from './Charts'
import PerformanceCalendar from './PerformanceCalendar'
function BreakdownTable({ trades, fields, currency, exportable = false }: { trades: Trade[]; fields: Field[]; currency: string; exportable?: boolean }) {
  const groups = groupTrades(trades, fields)
  const exportRows = () => {
    const rows = [[...fields.map(f => f.name), 'Trades with PnL', 'Net PnL', 'Win rate %', 'Profit factor', 'Expectancy', 'Max drawdown'], ...groups.map(g => [...g.labels, g.stats.count, g.stats.net, g.stats.winRate, g.stats.profitFactor ?? '', g.stats.expectancy, g.stats.maxDrawdown])]
    downloadFile('turbo-breakdown.csv', rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }
  return <>{exportable && <div className="table-toolbar"><span>{groups.length} combinations · {currency}</span><button className="text-button" onClick={exportRows}><Download size={14} /> Export breakdown</button></div>}<div className="table-scroll"><table><thead><tr>{fields.map(f => <th key={f.id}>{f.name}</th>)}<th className="numeric">Trades</th><th className="numeric">Net PnL</th><th className="numeric">Win rate</th><th className="numeric">Profit factor</th><th className="numeric">Expectancy</th><th className="numeric">Max DD</th></tr></thead><tbody>{groups.map(g => <tr key={JSON.stringify(g.labels)}>{g.labels.map((label, i) => <td key={i}><span className={i ? 'tag' : 'cell-strong'}>{label}</span></td>)}<td className="numeric">{g.stats.count}</td><td className={`numeric ${g.stats.net < 0 ? 'negative' : 'positive'}`}>{money(g.stats.net, currency)}</td><td className="numeric">{number(g.stats.winRate, 1)}%</td><td className="numeric">{number(g.stats.profitFactor)}</td><td className={`numeric ${g.stats.expectancy < 0 ? 'negative' : ''}`}>{money(g.stats.expectancy, currency)}</td><td className="numeric">{money(g.stats.maxDrawdown, currency)}</td></tr>)}</tbody></table></div></>
}
export default function Dashboard({ data, onNew, onDemo }: { data: JournalData; onNew: () => void; onDemo: () => void }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [group, setGroup] = useState('strategy'), [split, setSplit] = useState('contract')
  const [showFilters, setShowFilters] = useState(true)
  const completed = data.trades.filter(t => isComplete(t, data.fields))
  const trades = filterTrades(completed, filters), stats = metrics(trades)
  const analyzed = activeFields(data.fields).filter(f => f.analyze)
  const chosen = [group, split].map(id => analyzed.find(f => f.id === id)).filter((f): f is Field => !!f)
  const totalDemo = data.trades.filter(t => t.demo).length
  return <>
    <div className="page-heading"><div><div className="eyebrow">THE BIG PICTURE</div><h1>Performance overview<span className="heading-dot">.</span></h1><p>Find your edge. One trade, one pattern at a time.</p></div><button className="primary" onClick={onNew}>Log a trade <ArrowUpRight size={17} /></button></div>
    {!!totalDemo && <div className="notice">Sample data is included ({totalDemo} trades). Remove it in Settings when you’re ready to log your own.</div>}
    <div className="section-line"><div className="tabs-small"><span className="active">Overview</span><span>{trades.length} of {completed.length} completed trades</span></div><button className="secondary compact" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={15} />{showFilters ? 'Hide filters' : 'Show filters'}{filters.rules.length > 0 ? ` (${filters.rules.length})` : ''}</button></div>
    {showFilters && <FilterBar fields={data.fields} trades={completed} value={filters} onChange={setFilters} />}
    <StatCards trades={trades} currency={data.currency} />
    <PerformanceCalendar trades={trades} currency={data.currency} focusMonth={(filters.to || filters.from).slice(0, 7) || undefined} />
    {stats.excluded > 0 && <div className="notice">{stats.excluded} completed trade(s) have no numeric PnL and are excluded from monetary statistics.</div>}
    {!completed.length ? <div className="panel"><Empty title="Your edge starts here." action={<div className="button-row"><button className="primary" onClick={onNew}>Log your first trade <ArrowUpRight size={16} /></button>{!totalDemo && <button className="secondary" onClick={onDemo}>Explore sample data</button>}</div>}>Complete a trade to see your equity curve, strategy performance, and automatic characteristic breakdowns.</Empty></div> : !trades.length ? <div className="panel"><Empty title="No trades match these filters." action={<button className="secondary" onClick={() => setFilters(emptyFilters())}>Clear filters</button>}>Try a wider date range or a different combination.</Empty></div> : <>
      <div className="chart-grid"><section className="panel"><div className="panel-heading"><div><h2>Equity curve</h2><p>Your cumulative performance, trade by trade</p></div><span className="legend"><i />Net PnL</span></div><EquityChart data={stats.curve} currency={data.currency} /></section><section className="panel"><div className="panel-heading"><div><h2>Daily performance</h2><p>Net PnL by trading day</p></div><span className="tag">{dailyResults(trades).length} days</span></div><DailyChart data={dailyResults(trades)} currency={data.currency} /><div className="chart-caption">Hover over a bar for the date and PnL</div></section></div>
      <div className="detail-stats">{[['Gross profit', money(stats.grossProfit, data.currency)], ['Gross loss', money(stats.grossLoss, data.currency)], ['Average win', money(stats.avgWin, data.currency)], ['Average loss', money(stats.avgLoss, data.currency)], ['Max drawdown', money(stats.maxDrawdown, data.currency)], ['Best / worst trade', `${money(stats.best, data.currency)} / ${money(stats.worst, data.currency)}`], ['Longest win / loss streak', `${stats.longestWin} / ${stats.longestLoss} trades`], ['Avg. hold time', stats.avgDuration === null ? '—' : `${number(stats.avgDuration, 1)} min`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className="panel"><div className="panel-heading"><div><div className="eyebrow">FIND WHAT WORKS TOGETHER</div><h2>Performance breakdown</h2><p>Separate your strategies by contract, account, or any characteristic.</p></div><Layers3 className="muted" size={22} /></div>
        <div className="group-controls"><label>Group by<select aria-label="Group by" value={analyzed.some(f => f.id === group) ? group : ''} onChange={e => { setGroup(e.target.value); if (split === e.target.value) setSplit('') }}><option value="">All trades</option>{analyzed.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label><span className="group-cross">×</span><label>Then separate by<select aria-label="Then separate by" value={analyzed.some(f => f.id === split) ? split : ''} onChange={e => setSplit(e.target.value)}><option value="">No secondary split</option>{analyzed.filter(f => f.id !== group).map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label><span className="help-text">Every row is a separate combination.</span></div>
        <BreakdownTable trades={trades} fields={chosen} currency={data.currency} exportable />
      </section>
      <div className="section-intro"><div className="eyebrow">GO A LEVEL DEEPER</div><h2>Every characteristic. Automatically.</h2><p>All enabled characteristics use your current filters. Numeric values with more than 8 unique values are grouped into 5 equal-width ranges.</p></div>
      <div className="breakdown-list">{analyzed.map(f => <details className="panel breakdown-detail" key={f.id}><summary><span><span className="type-icon">{['decimal', 'integer', 'percent', 'score'].includes(f.type) ? '#' : 'Aa'}</span>{f.name}</span><span className="muted">{groupTrades(trades, [f]).length} groups <span className="chevron">⌄</span></span></summary><BreakdownTable trades={trades} fields={[f]} currency={data.currency} /></details>)}</div>
      <details className="methodology"><summary>How these statistics are calculated</summary><p>PnL is the net result you enter, including any costs you choose to include. Win rate = profitable trades / all trades with PnL; breakeven trades stay in the denominator. Profit factor = gross profit / absolute gross loss; ∞ means profits with no losses. Expectancy = net PnL / trades with PnL. Maximum drawdown measures the largest peak-to-trough decline from a starting cumulative PnL of zero, ordered by entry date and time. Missing characteristics appear as “Not recorded”. Earlier exit times are treated as the next day; hold-time statistics support trades lasting less than 24 hours. All amounts use the display currency without currency conversion. Small samples are descriptive, not predictions.</p></details>
    </>}
  </>
}
