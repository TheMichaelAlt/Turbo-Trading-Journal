import { useEffect, useId, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { today, type Trade } from '../lib/model'
import { metrics } from '../lib/analytics'
import { calendarCells, dailyStats, shiftMonth, validMonth } from '../lib/calendar'
import { money, number } from '../lib/format'
import { Modal } from './ui'
import './PerformanceCalendar.css'

import { DEFAULT_TRADING_DAY_END, tradingDay } from '../lib/tradingDay'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const longDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export default function PerformanceCalendar({ trades, currency, focusMonth, tradingDayEnd = DEFAULT_TRADING_DAY_END }: { trades: Trade[]; currency: string; focusMonth?: string; tradingDayEnd?: string }) {
  const titleId = useId()
  const [month, setMonth] = useState(focusMonth || today().slice(0, 7))
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => { if (focusMonth && validMonth(focusMonth)) setMonth(focusMonth) }, [focusMonth])
  const days = useMemo(() => dailyStats(trades, tradingDayEnd), [trades, tradingDayEnd])
  const monthTrades = trades.filter(t => tradingDay(t, tradingDayEnd).startsWith(month))
  const summary = metrics(monthTrades)
  const detail = selected ? days.get(selected) : undefined
  const winRate = (stats: ReturnType<typeof metrics>) => stats.count ? `${number(stats.winRate, 1)}%` : '—'
  const pnl = (stats: ReturnType<typeof metrics>) => stats.count ? money(stats.net, currency) : '—'

  return <section className="panel performance-calendar" aria-labelledby={titleId}>
    <div className="panel-heading calendar-heading">
      <div><h2 id={titleId}><CalendarDays size={18} />Trading calendar</h2><p>Daily stats from your filtered, completed trades. Entries after {tradingDayEnd} count toward the next day. Select a trading day for details.</p></div>
      <div className="calendar-controls">
        <button className="icon-button" aria-label="Previous month" disabled={month === '0001-01'} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={17} /></button>
        <input aria-label="Calendar month" type="month" min="0001-01" max="9999-12" value={month} onChange={e => { if (validMonth(e.target.value)) setMonth(e.target.value) }} />
        <button className="icon-button" aria-label="Next month" disabled={month === '9999-12'} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={17} /></button>
        <button className="text-button" onClick={() => setMonth(today().slice(0, 7))}>This month</button>
      </div>
    </div>
    <div className="calendar-month-stats" aria-label="Calendar month summary">
      <span className="eyebrow">MONTH AT A GLANCE</span>
      <span>Net PnL <strong className={summary.net < 0 ? 'negative' : 'positive'}>{pnl(summary)}</strong></span>
      <span><strong>{monthTrades.length}</strong> trades</span>
      <span><strong>{winRate(summary)}</strong> win rate</span>
      <span className="calendar-legend"><i />Profit <i className="loss" />Loss</span>
    </div>
    <div className="calendar-scroll" tabIndex={0} role="region" aria-label="Daily trading calendar">
      <div className="calendar-grid">
        {weekdays.map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
        {calendarCells(month).map(cell => {
          const result = cell.inMonth ? days.get(cell.date) : undefined
          const tone = result?.stats.count ? result.stats.net > 0 ? 'profit' : result.stats.net < 0 ? 'loss' : 'flat' : ''
          const label = result ? `${longDate(cell.date)}: PnL ${pnl(result.stats)}, ${result.tradeCount} trades, ${winRate(result.stats)} win rate. Strategies: ${result.strategies.join(', ') || 'Not recorded'}.` : `${longDate(cell.date)}: no completed trades`
          return <button type="button" key={cell.date} data-date={cell.date} className={`calendar-day ${cell.inMonth ? '' : 'outside'} ${tone}`} disabled={!result} aria-label={label} onClick={() => setSelected(cell.date)}>
            <span className={`calendar-day-number ${cell.date === today() ? 'is-today' : ''}`}>{cell.day}</span>
            {result ? <>
              <strong className={`calendar-day-pnl ${tone === 'loss' ? 'negative' : tone === 'profit' ? 'positive' : ''}`}>{pnl(result.stats)}</strong>
              <span className="calendar-day-metrics"><span>{result.tradeCount} {result.tradeCount === 1 ? 'trade' : 'trades'}</span><span>{winRate(result.stats)} <span className="win-label">win</span></span></span>
              <span className="calendar-strategies" title={result.strategies.join(', ')}>{result.strategies.slice(0, 2).map(strategy => <span key={strategy}>{strategy}</span>)}{result.strategies.length > 2 && <span className="more-strategies">+{result.strategies.length - 2} more</span>}{!result.strategies.length && <span className="more-strategies">No strategy recorded</span>}</span>
            </> : cell.inMonth && <span className="calendar-no-trades">—</span>}
          </button>
        })}
      </div>
    </div>
    <div className="calendar-footer"><span>{monthTrades.length ? 'Win rate includes breakeven trades. Amounts use your display currency.' : 'No completed trades in this month match your current filters.'}</span>{summary.excluded > 0 && <span>{summary.excluded} trade(s) without PnL excluded from PnL and win rate.</span>}</div>
    {selected && detail && <Modal title={longDate(selected)} onClose={() => setSelected(null)}>
      <div className="calendar-detail-stats"><div><span>Net PnL</span><strong className={detail.stats.net < 0 ? 'negative' : 'positive'}>{pnl(detail.stats)}</strong></div><div><span>Trades</span><strong>{detail.tradeCount}</strong></div><div><span>Win rate</span><strong>{winRate(detail.stats)}</strong></div></div>
      <p>{detail.stats.wins} wins · {detail.stats.losses} losses · {detail.stats.breakeven} breakeven</p>
      <h3 className="calendar-strategies-title">Strategies used</h3><div className="calendar-strategy-list">{detail.strategies.map(strategy => <span className="tag" key={strategy}>{strategy}</span>)}{detail.withoutStrategy > 0 && <span className="muted">{detail.withoutStrategy} trade(s) without a strategy</span>}</div>
      {detail.stats.excluded > 0 && <p>{detail.stats.excluded} trade(s) have no PnL and are excluded from PnL and win rate.</p>}
      <div className="modal-actions"><button className="secondary" onClick={() => setSelected(null)}>Close</button></div>
    </Modal>}
  </section>
}
